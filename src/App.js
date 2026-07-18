import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { db } from "./firebase/firebase"; // 파이어베이스 설정 파일
import { doc, getDoc, getDocs, collection, addDoc, query, where } from "firebase/firestore";
import bcrypt from 'bcryptjs';
import './App.css';
import Admin from './Admin';
import Caller from './Caller';
import Sheet from './Sheet';
import HomeVisual from './HomeVisual';
import videoFile from './img/Noctis인트로정사각형.mp4'; // 준비한 영상 경로
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
        className="logo-box"
      />
      {/* 로그인했을 때만 시트지 버튼 노출 */}
      {user && (
        <button className="appBtn" onClick={handleSheetClick}>
          파이트 & 아발 우물 시트지
        </button>
      )}
    </div>
  );
};

const Navbar = ({ user, onOpenModal, onLogout, checkAndLogout }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const canAccessAdmin = user?.role === 'admin';
  const canAccessCaller = user?.role === 'admin' || user?.role === 'caller';

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMenuOpen(false); // 창이 커지면 드롭다운 자동 닫기
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = async (path, role) => {
    setIsMenuOpen(false);
    const isTampered = await checkAndLogout(role);
    if (!isTampered) navigate(path);
  };

  return (
    <header className="navbar">
      {/* 1. 햄버거 버튼 (모바일 전용) */}
      <button className="menu-toggle" style={{ display: 'none' }} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>

      {/* 2. 기존 PC 메뉴들 (nav-left, nav-center, nav-right 그대로 유지) */}
      <div className="nav-left">
        {canAccessAdmin && <button className='appBtn' onClick={() => handleNavClick('/admin', 'admin')}>관리자</button>}
        {canAccessCaller && <button className='appBtn' onClick={() => handleNavClick('/caller', 'caller')}>콜 러</button>}
      </div>

      <div className="nav-center">
        <img src={logoText} alt="로고" onClick={() => navigate('/')} style={{ cursor: 'pointer', height: '40px' }} />
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

      {/* 3. 모바일 전용 드롭다운 */}
      {isMenuOpen && (
        <div className="mobile-dropdown">
          {user && <span>{user.name}님 환영합니다</span>}
          {canAccessAdmin && <button className='appBtn' onClick={() => handleNavClick('/admin', 'admin')}>관리자</button>}
          {canAccessCaller && <button className='appBtn' onClick={() => handleNavClick('/caller', 'caller')}>콜 러</button>}
          <button className='appBtn' onClick={() => handleNavClick('/', 'member')}>홈으로</button>
          {user ? (
            <button className='appBtn' onClick={() => { setIsMenuOpen(false); onLogout(); }}>로그아웃</button>
          ) : (
            <>
              <button className='appBtn' onClick={() => { setIsMenuOpen(false); onOpenModal('login'); }}>로그인</button>
              <button className='appBtn' onClick={() => { setIsMenuOpen(false); onOpenModal('signup'); }}>회원가입</button>
            </>
          )}
        </div>
      )}
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
  const [rememberMe, setRememberMe] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // [추가] 초기화 상태

  useEffect(() => {
    const checkSessionSecurity = async () => {
      // [변경] local 또는 session 스토리지 중 있는 것을 가져옴
      const rawData = localStorage.getItem('user') || sessionStorage.getItem('user');
      const savedUser = rawData ? JSON.parse(rawData) : null;

      if (savedUser?.uid) {
        try {
          const userSnap = await getDoc(doc(db, "users", savedUser.uid));
          if (!userSnap.exists() || userSnap.data().role !== savedUser.role) {
            handleLogout();
            return;
          }
          setUser(savedUser);
        } catch (error) {
          handleLogout();
        }
      }
      setIsInitialized(true); // [추가] 검증 완료
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
        if (rememberMe) {
          localStorage.setItem('user', JSON.stringify(userSession));
        } else {
          sessionStorage.setItem('user', JSON.stringify(userSession));
        }
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
    const savedUser = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user'));

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
    localStorage.removeItem('user'); // [추가]
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

  if (!isInitialized) return <div className="loading">Loading...</div>;

  return (
    <div className="app-container">
      <Navbar user={user} onOpenModal={setModalType} onLogout={handleLogout} checkAndLogout={checkAndLogout} />

      <Routes>
        {/* 1. 홈 화면 */}
        <Route
          path="/"
          element={<Main user={user} navigate={navigate} checkAndLogout={checkAndLogout} />}
        />

        {/* 2. 관리자 페이지 (보호됨: user가 없으면 홈으로) */}
        <Route
          path="/admin"
          element={user ? <Admin checkAndLogout={checkAndLogout} /> : <Navigate to="/" replace />}
        />

        {/* 3. 콜러 페이지 (보호됨: user가 없으면 홈으로) */}
        <Route
          path="/caller"
          element={user ? <Caller user={user} checkAndLogout={checkAndLogout} /> : <Navigate to="/" replace />}
        />

        {/* 4. 시트지 페이지 (보호됨: user가 없으면 홈으로) */}
        <Route
          path="/sheet"
          element={user ? <Sheet user={user} checkAndLogout={checkAndLogout} /> : <Navigate to="/" replace />}
        />

        {/* 5. 잘못된 경로로 접근 시 홈으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
                  <p>길드 변경시  오피서에게 디엠주세요</p>

                  {/* [추가] 자동 로그인 체크박스 */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center", // 전체 중앙 정렬
                    gap: "8px",
                    marginBottom: "10px"
                  }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ margin: 0, cursor: "pointer" }}
                    />
                    <label style={{
                      color: "white",
                      fontSize: "14px",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}>
                      로그인 상태 유지
                    </label>
                  </div>

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