import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { db } from "./firebase/firebase"; // 파이어베이스 설정 파일
import { doc, getDoc, getDocs, collection, addDoc, query, where } from "firebase/firestore";
import bcrypt from 'bcryptjs';
import './App.css';
import Admin from './Admin';
import Caller from './Caller';
import Sheet from './Sheet';
import HomeVisual from './HomeVisual';
import videoFile from './img/Noctis인트로정사각형.mp4'; // 준비한 영상 경로
import logoImage from './img/영상미리보기.jpg';      // 썸네일로 쓸 이미지
import logoText from './img/녹티스문구.png'

const Main = ({ user, navigate, checkAndLogout }) => {
  const handleSheetClick = async () => {
    const isTampered = await checkAndLogout(user.role); // 현재 세션의 role로 검증
    if (!isTampered) navigate('/sheet');
  };
  return (
    <div className="main-content">
      <HomeVisual
        videoSrc={videoFile}
        thumbSrc={logoImage}
        className="logo-box"
      />
      {/* 로그인했을 때만 시트지 버튼 노출 */}
      {user && (
        <button className="appBtn" onClick={handleSheetClick}>
          시트지 확인
        </button>
      )}
    </div>
  );
};

const Navbar = ({ user, onOpenModal, onLogout, checkAndLogout }) => {
  const navigate = useNavigate();
  const canAccessAdmin = user?.role === 'admin';
  const canAccessCaller = user?.role === 'admin' || user?.role === 'caller';
  const handleNavClick = async (path, role) => {
    const isTampered = await checkAndLogout(role);
    if (!isTampered) navigate(path); // 조작이 없을 때만 이동
  };
  return (
    <header className="navbar">
      <div className="nav-left">
        {canAccessAdmin && (
          <button className='appBtn' onClick={() => handleNavClick('/admin', 'admin')}>관리자</button>
        )}
        {canAccessCaller && (
          <button className='appBtn' onClick={() => handleNavClick('/caller', 'caller')}>콜 러</button>
        )}
      </div>
      <div className="nav-center">
        <img
          src={logoText} // public 폴더에 있다면 바로 경로 입력, 아니면 import
          alt="로고 문구"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer', height: '40px' }} // 높이 조절
        />
      </div>
      <div className="nav-right">
        {user ? (
          <>
            <span>{user.name}님 환영합니다</span>
            <button className='appBtn' onClick={() => navigate('/')}>홈으로</button>
            <button className='appBtn' onClick={onLogout}>로그아웃</button>
          </>
        ) : (
          <>
            <button className='appBtn' onClick={() => navigate('/')}>홈으로</button>
            <button className='appBtn' onClick={() => onOpenModal('login')}>로그인</button>
            <button className='appBtn' onClick={() => onOpenModal('signup')}>회원가입</button>
          </>
        )}
      </div>
    </header>
  );
};

export default function App() {
  const navigate = useNavigate();
  const [modalType, setModalType] = useState(null);
  const [user, setUser] = useState(null);
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupGuild, setSignupGuild] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");

  useEffect(() => {
    const checkSessionSecurity = async () => {
      const savedUser = JSON.parse(sessionStorage.getItem('user'));

      if (savedUser?.uid) {
        try {
          const userSnap = await getDoc(doc(db, "users", savedUser.uid));

          // 1. 유저가 DB에 없거나, 권한이 세션과 다른 경우
          if (!userSnap.exists() || userSnap.data().role !== savedUser.role) {
            alert("보안 위반이 감지되었습니다. 로그아웃합니다.");
            handleLogout();
            return;
          }

          // 2. 정상이라면 상태 유지
          setUser(savedUser);
        } catch (error) {
          handleLogout();
        }
      }
    };

    checkSessionSecurity();
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault(); // 폼 제출 이벤트 차단
    if (!loginId || !loginPassword) {
      alert("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    try {
      const q = query(collection(db, "users"), where("name", "==", loginId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("존재하지 않는 계정입니다.");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      const isMatch = await bcrypt.compare(loginPassword, userData.password);

      if (isMatch) {
        const userSession = {
          uid: userDoc.id,
          name: userData.name,
          role: userData.role,
          guild: userData.guild // 파이어베이스 users 문서에 저장된 guild 값을 가져옵니다
        };

        setUser(userSession);
        sessionStorage.setItem('user', JSON.stringify(userSession));
        alert(`${userData.name}님 환영합니다.`);
        setModalType(null);
      } else {
        alert("비밀번호가 틀렸습니다.");
      }
    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인 중 오류가 발생했습니다.");
    }
  };

  const checkAndLogout = async (requiredRole) => {
    const savedUser = JSON.parse(sessionStorage.getItem('user'));

    if (!savedUser?.uid || !savedUser?.name) {
      handleLogout();
      return true;
    }

    try {
      const userSnap = await getDoc(doc(db, "users", savedUser.uid));
      const dbData = userSnap.data();

      // 1. 유저 정보(이름) 변조 확인 (필수 체크)
      if (!userSnap.exists() || dbData.name !== savedUser.name) {
        alert("경고: 계정 정보가 변조되었습니다. 보안상 로그아웃합니다.");
        handleLogout();
        return true;
      }

      // 2. 권한 검증 
      // 만약 requiredRole이 'member'라면 권한 체크 없이 정보 변조 여부만 확인 후 통과
      if (requiredRole === 'member') return false;

      // 관리자(admin)는 어떤 페이지든 통과
      if (dbData.role === 'admin') return false;

      // 어드민이 아닌데 특정 권한(caller)이 필요한 페이지라면 검증
      if (dbData.role !== requiredRole) {
        alert("경고: 권한이 없습니다.");
        handleLogout();
        return true;
      }

      return false; // 모든 검증 통과
    } catch (e) {
      handleLogout();
      return true;
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    window.location.href = "/Noctis/#/";
  };

  const handleSignup = async () => {
    // 길드명 입력 여부도 체크 추가
    if (!signupName || !signupGuild || !signupPassword || !signupPasswordConfirm) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      const hashedPassword = await bcrypt.hash(signupPassword, 10);

      await addDoc(collection(db, "preMembers"), {
        name: signupName,
        guild: signupGuild, // 길드명 저장
        password: hashedPassword,
        createdAt: new Date(),
      });
      alert("가입 요청이 완료되었습니다.");
      setModalType(null);
      setSignupName("");
      setSignupGuild(""); // 초기화
      setSignupPassword("");
      setSignupPasswordConfirm("");
    } catch (error) {
      console.error("회원가입 실패:", error);
      alert("가입 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="app-container">
      <Navbar user={user} onOpenModal={setModalType} onLogout={handleLogout} checkAndLogout={checkAndLogout} />

      <Routes>
        <Route path="/" element={<Main user={user} navigate={navigate} checkAndLogout={checkAndLogout} />} />
        <Route path="/admin" element={<Admin checkAndLogout={checkAndLogout} />} />
        <Route path="/caller" element={<Caller user={user} checkAndLogout={checkAndLogout} />} />
        <Route path="/sheet" element={<Sheet user={user} checkAndLogout={checkAndLogout} />} />
      </Routes>

      {modalType && (
        <div className="modal-overlay">
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            {/* [변경] 우상단 X 버튼 */}
            <button
              onClick={() => setModalType(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "15px",
                background: "transparent",
                border: "none",
                color: "White",
                fontSize: "28px",
                cursor: "pointer",
                fontWeight: "bold",
                lineHeight: "1"
              }}
            >
              &times;
            </button>
            <h2 style={{ margin: "0" }}>{modalType === 'login' ? '로그인' : '회원가입'}</h2>

            {modalType === 'signup' ? (
              // 회원가입 폼
              <form style={{
                width: "100%"
              }} onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  <input type="text" placeholder="인게임 닉네임" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                  <input type="text" placeholder="영문 길드명" value={signupGuild} onChange={(e) => setSignupGuild(e.target.value)} /> {/* 추가된 필드 */}
                  <input type="password" placeholder="비밀번호" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                  <input type="password" placeholder="비밀번호 확인" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} />
                  <p>회원가입 후 관리자, 오피서에게 디엠주세요</p>
                  <button className='appBtn' style={{ width: "60%" }} type="submit">회원가입</button>
                </div>
              </form>
            ) : (
              // 로그인 폼
              <form style={{
                width: "100%"
              }} onSubmit={handleLogin}>
                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  <input
                    type="text"
                    placeholder="아이디"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <p>길드 변경시 관리자, 오피서에게 디엠주세요</p>
                  <button className='appBtn' style={{ width: "60%" }} type="submit">로그인</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}