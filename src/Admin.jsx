import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  setDoc, // 추가
  query, // 추가
  where, // 추가
  updateDoc, // 추가
} from "firebase/firestore";

const Admin = ({ user, checkAndLogout }) => {
  const navigate = useNavigate();
  const [preMembers, setPreMembers] = useState([]);
  const [showModal, setShowModal] = useState(null); // 'members' 또는 'addCaller'
  const [callerName, setCallerName] = useState("");

  useEffect(() => {
    const verify = async () => {
      // 관리자 페이지이므로 'admin' 권한 검증
      const isTampered = await checkAndLogout("admin");
      if (isTampered) {
        // 변조되었으면 이미 checkAndLogout 안에서 로그아웃 처리됨
        navigate("/");
      }
    };
    verify();
  }, []);

  // 예비 멤버 리스트 불러오기
  const fetchPreMembers = async () => {
    const querySnapshot = await getDocs(collection(db, "preMembers"));
    setPreMembers(
      querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
  };

  const handleAddAdmin = async () => {
    if (!callerName) return alert("이름을 입력해주세요.");

    try {
      const q = query(collection(db, "users"), where("name", "==", callerName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("해당 이름의 사용자가 존재하지 않습니다.");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), {
        role: "admin",
      });

      alert(`${callerName}님이 관리자로 임명되었습니다.`);
      setCallerName("");
      setShowModal(null);
    } catch (e) {
      console.error("관리자 지정 오류:", e);
      alert("관리자 지정에 실패했습니다.");
    }
  };

  const handleAddCaller = async () => {
    if (!callerName) return alert("이름을 입력해주세요.");

    try {
      // 1. users 컬렉션에서 해당 이름의 유저 찾기
      const q = query(collection(db, "users"), where("name", "==", callerName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("해당 이름의 사용자가 users 컬렉션에 존재하지 않습니다.");
        return;
      }

      // 2. 검색된 유저의 문서 ID를 가져와서 role을 caller로 업데이트
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), {
        role: "caller",
      });

      alert(`${callerName}님이 콜러로 임명되었습니다.`);
      setCallerName(""); // 이름 입력창 초기화
      setShowModal(null);
    } catch (e) {
      console.error("콜러 지정 오류:", e);
      alert("콜러 지정에 실패했습니다.");
    }
  };

  // 승인 로직 (예비 멤버를 users 컬렉션으로 이동 등 향후 구현)
  const approveMember = async (member) => {
    if (
      !window.confirm(`${member.name}(${member.guild})님을 승인하시겠습니까?`)
    )
      return;

    try {
      // 1. users 컬렉션에 길드 정보 포함하여 추가
      await addDoc(collection(db, "users"), {
        name: member.name,
        guild: member.guild, // 길드명 추가 저장
        password: member.password,
        role: "member",
        approvedAt: new Date(),
      });

      // 2. preMembers에서 해당 문서 삭제
      await deleteDoc(doc(db, "preMembers", member.id));

      alert("승인되었습니다.");
      fetchPreMembers();
    } catch (e) {
      console.error("승인 오류:", e);
      alert("승인 중 오류가 발생했습니다.");
    }
  };

  return (
    <div
      style={{
        flex: "1",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "2rem",
        flexDirection: "column",
        gap: "20px",
        padding: "20px",
      }}
    >
      <h2 style={{ margin: "10px" }}>관리자 메뉴</h2>
      {/* 추가된 규칙 안내 박스 */}
      <div
        style={{
          width: "90%",
          maxWidth: "600px",
          padding: "15px",
          background: "#333",
          borderRadius: "8px",
          border: "1px solid #555",
          fontSize: "14px",
          textAlign: "left",
          color: "#ddd",
        }}
      >
        <p
          style={{ margin: "0 0 10px 0", fontWeight: "bold", color: "#ffcc00" }}
        >
          [관리자 페이지 사용 방법]
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6" }}>
          <li>
            <strong>가입 요청 확인 버튼:</strong> 가입 요청 리스트가 나옵니다.
            이름과 길드를 확인 후 승인하세요.
          </li>
          <li>
            <strong>콜러 추가하기 버튼:</strong> 가입된 콜러의 닉네임을 입력하고
            임명하기를 클릭하면 콜러 권한을 부여합니다.
          </li>
          <li>
            <strong>관리자 추가 버튼:</strong> 가입 승인, 콜러 추가 권한이 있는
            관리자를 임명합니다.
          </li>
        </ul>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          className="btn"
          onClick={() => {
            fetchPreMembers();
            setShowModal("members");
          }}
        >
          가입 요청 확인
        </button>
        <button className="btn" onClick={() => setShowModal("addCaller")}>
          콜러 추가
        </button>
        <button className="btn" onClick={() => setShowModal("addAdmin")}>
          관리자 추가
        </button>
      </div>

      {/* 모달 팝업 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div
            className="login-modal"
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(null)}
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
                lineHeight: "1",
              }}
            >
              &times;
            </button>
            {showModal === "members" ? (
              <>
                <h4 style={{ margin: "10px" }}>가입 요청 리스트</h4>
                {preMembers.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center", // 세로 정렬 추가
                      margin: "10px 0",
                      padding: "5px",
                      borderBottom: "1px solid #444",
                    }}
                  >
                    {/* 닉네임과 길드명 표시 */}
                    <span style={{ fontSize: "1.2rem", margin: "0 15px" }}>
                      <strong>{m.name}</strong> |{" "}
                      <span style={{ color: "#00d4ff" }}>{m.guild}</span>
                    </span>
                    <button onClick={() => approveMember(m)} className="btn">
                      승인
                    </button>
                  </div>
                ))}
              </>
            ) : showModal === "addCaller" ? (
              <>
                <h2>콜러 임명</h2>
                <input
                  type="text"
                  placeholder="사용자 닉네임"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                />
                <button className="btn" onClick={handleAddCaller}>
                  임명하기
                </button>
              </>
            ) : (
              <>
                <h2>관리자 임명</h2>
                <input
                  type="text"
                  placeholder="사용자 닉네임"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                />
                <button className="btn" onClick={handleAddAdmin}>
                  임명하기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
