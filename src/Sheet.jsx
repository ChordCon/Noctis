import React, { useState, useEffect } from "react";
import "./Sheet.css";
import unKnown from "./img/UnKnown.png";
import { db } from "./firebase/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
} from "firebase/firestore";

const Sheet = ({ user, checkAndLogout }) => {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [itemImages, setItemImages] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(null); // {pIdx, r} 또는 null
  const [comment, setComment] = useState(""); // 팝업 내 코멘트 내용

  useEffect(() => {
    // 1. 이미지 로드 로직 (한 번만 실행)
    const fetchImages = async () => {
      const categories = [
        "weapons",
        "OffHand",
        "Helmet",
        "Armor",
        "Shoes",
        "Cape",
        "Food",
        "Potion",
      ];
      const newImages = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const docRef = doc(db, cat, "list");
            const snap = await getDoc(docRef);
            if (snap.exists()) newImages[cat] = snap.data();
          } catch (e) {
            console.error(`${cat} 로드 실패:`, e);
          }
        }),
      );
      setItemImages(newImages);
    };

    fetchImages();

    // 2. 기록 실시간 구독 (onSnapshot)
    const q = query(collection(db, "records"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedRecords = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRecords(updatedRecords);

      // 팝업이 열려있다면 팝업 데이터만 부분 업데이트
      setSelectedRecord((prev) => {
        if (!prev) return null;
        const latest = updatedRecords.find((r) => r.id === prev.id);

        // 내용이 실제로 바뀐 경우에만 상태를 교체하여 리렌더링 최소화
        if (
          latest &&
          JSON.stringify(latest.sheetContent) !==
            JSON.stringify(prev.sheetContent)
        ) {
          return { ...prev, sheetContent: latest.sheetContent };
        }
        return prev;
      });
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribe();
  }, []); // 의존성 배열을 비워두어 컴포넌트 마운트 시 딱 한 번만 실행

  const handleDeleteRecord = async (e, recordId, callerName) => {
    e.stopPropagation(); // 행 클릭 이벤트(모달 열기) 방지

    const isAdmin = user?.role === "admin";
    const isOwner = user?.name === callerName;

    if (!isAdmin && !isOwner) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    if (window.confirm("정말 이 시트지를 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "records", recordId));
        setRecords(records.filter((r) => r.id !== recordId)); // 로컬 상태 업데이트
        alert("삭제되었습니다.");
      } catch (e) {
        console.error("삭제 실패:", e);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const handleInputChange = (pIdx, r, c, val) => {
    setSelectedRecord((prev) => ({
      ...prev,
      sheetContent: {
        ...prev.sheetContent,
        [`${pIdx}-${r}-${c}`]: val,
      },
    }));
  };

  // 삭제(잠금 해제) 버튼: 행의 데이터를 초기화하고 잠금 해제
  const handleUnlock = async (pIdx, r) => {
    if (!window.confirm("참여 및 잠금을 해제하시겠습니까?")) return;

    const updatedContent = { ...selectedRecord.sheetContent };
    updatedContent[`${pIdx}-${r}-1`] = "";
    updatedContent[`${pIdx}-${r}-2`] = "";
    delete updatedContent[`locked-${pIdx}-${r}`];

    try {
      const docRef = doc(db, "records", selectedRecord.id);

      // 1. 시트 데이터 업데이트
      await updateDoc(docRef, { sheetContent: updatedContent });

      // 2. 참여 횟수 -1 차감
      const timeKey = selectedRecord.time || "unknown";
      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        [`participationCount.${timeKey}`]: increment(-1),
      });

      setSelectedRecord({ ...selectedRecord, sheetContent: updatedContent });
      alert("참여 및 잠금이 해제되었습니다.");
    } catch (e) {
      console.error("삭제 실패:", e);
      alert("데이터 삭제에 실패했습니다.");
    }
  };

  // 참 여 버튼 클릭 시 호출
  const handleInitiateConfirm = async (pIdx, r) => {
    // 1. 로그인 정보 확인
    if (!user?.guild || !user?.name) {
      alert("로그인 정보에 길드나 이름이 없습니다.");
      return;
    }

    // 2. 최신 데이터 가져오기
    const docRef = doc(db, "records", selectedRecord.id);
    const docSnap = await getDoc(docRef);
    const latestData = docSnap.data();

    if (latestData.sheetContent[`locked-${pIdx}-${r}`]) {
      alert("이미 작성된 행입니다.");
      return;
    }

    const commentKey = `${pIdx}-${r}-17`;
    const existingComment =
      latestData.sheetContent[commentKey] || "작성된 코멘트가 없습니다.";

    setComment(existingComment);
    setShowCommentModal({ pIdx, r });
  };

  // 확인 버튼 클릭 시 호출 (참여 횟수 기록 포함)
  const handleFinalConfirm = async () => {
    const { pIdx, r } = showCommentModal;

    try {
      const docRef = doc(db, "records", selectedRecord.id);

      // 1. 현재 화면에 입력된 인풋 값을 우선적으로 가져옴
      const currentInputGuild = selectedRecord.sheetContent[`${pIdx}-${r}-1`];
      const currentInputName = selectedRecord.sheetContent[`${pIdx}-${r}-2`];

      // 2. 입력된 값이 있으면 사용, 없으면 로그인 정보 사용
      const guildToSave =
        currentInputGuild && currentInputGuild.trim() !== ""
          ? currentInputGuild
          : user.guild;
      const nameToSave =
        currentInputName && currentInputName.trim() !== ""
          ? currentInputName
          : user.name;

      // 3. 다시 최신 데이터를 불러와서 중복 체크 및 업데이트
      const docSnap = await getDoc(docRef);
      const latestData = docSnap.data();
      const latestContent = latestData.sheetContent || {};

      // 멤버 권한 중복 체크
      if (user?.role === "member") {
        const isAlreadyParticipated = Object.keys(latestContent).some((key) => {
          const parts = key.split("-");
          return (
            parts.length === 3 &&
            parts[2] === "2" &&
            latestContent[key] === nameToSave
          );
        });

        if (isAlreadyParticipated) {
          alert("이미 해당 이름으로 참여 중입니다.");
          setShowCommentModal(null);
          return;
        }
      }

      const updatedContent = {
        ...latestContent,
        [`${pIdx}-${r}-1`]: guildToSave,
        [`${pIdx}-${r}-2`]: nameToSave,
        [`locked-${pIdx}-${r}`]: true,
      };

      // 시트 데이터 업데이트
      await updateDoc(docRef, { sheetContent: updatedContent });

      // 4. 유저별 참여 횟수 업데이트
      // 시트지의 시간 필드 사용 (예: "16:00")
      const timeKey = selectedRecord.time || "unknown";
      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        [`participationCount.${timeKey}`]: increment(1),
      });

      setSelectedRecord((prev) => ({ ...prev, sheetContent: updatedContent }));
      alert("저장되었습니다.");
      setShowCommentModal(null);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  // 모달 닫기 공통 함수
  const handleCloseModal = () => {
    setSelectedRecord(null);
  };

  const headers = [
    { name: "Check", span: 1 },
    { name: "Roll", span: 1 },
    { name: "Guild", span: 1 },
    { name: "Name", span: 1 },
    { name: "Weapon", span: 1 },
    { name: "Off-Hand", span: 1 }, // 1열
    { name: "Helmet", span: 2 }, // 2열
    { name: "Armor", span: 2 }, // 2열
    { name: "Shoes", span: 2 }, // 2열
    { name: "Cape", span: 2 }, // 2열
    { name: "Food", span: 2 }, // 2열
    { name: "Potion", span: 2 }, // 2열
  ];

  // 열 인덱스(c)와 컬렉션 이름 매핑
  const colCategoryMap = {
    3: "weapons",
    4: "OffHand",
    // Helmet이 2칸을 차지한다면 5, 6번 인덱스 둘 다 Helmet이어야 합니다.
    5: "Helmet",
    6: "Helmet",
    7: "Armor",
    8: "Armor",
    9: "Shoes",
    10: "Shoes",
    11: "Cape",
    12: "Cape",
    13: "Food",
    14: "Food",
    15: "Potion",
    16: "Potion",
    17: "Check",
  };

  return (
    <div
      className="page-view"
      style={{ padding: "20px", color: "white", textAlign: "center" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* 추가된 규칙 안내 박스 */}
        <div
          style={{
            width: "90%",
            maxWidth: "800px",
            padding: "15px",
            background: "#333",
            borderRadius: "8px",
            border: "1px solid #555",
            fontSize: "20px",
            textAlign: "left",
            color: "#ddd",
          }}
        >
          <p
            className="responsive-text"
            style={{
              margin: "0 0 10px 0",
              fontWeight: "bold",
              color: "#ffcc00",
            }}
          >
            [시트지 사용 방법]
          </p>
          <ul
            className="responsive-text"
            style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6" }}
          >
            <li>
              시트지 목록의 날짜, 시간등을 확인한 후 작성하려는 시트지를
              클릭해주세요.
            </li>
            <li>
              관리자, 콜러는 사용한 시트지를 관리창에 삭제 버튼을 이용해서
              삭제해주세요.
            </li>
          </ul>
        </div>
        <h2 className="responsive-title" style={{ margin: "10px" }}>
          시트지 목록
        </h2>
        {/* PC 버전 테이블 */}
        <table
          border="1"
          className="desktop-only-table"
          style={{
            width: "90%",
            margin: "10px 0",
            borderCollapse: "collapse",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <thead>
            <tr className="responsive-text" style={{ background: "#333" }}>
              <th style={{ padding: "5px" }}>날짜</th>
              <th style={{ padding: "5px" }}>시트지</th>
              <th style={{ padding: "5px" }}>집합 시간</th>
              <th style={{ padding: "5px" }}>코멘트</th>
              <th style={{ padding: "5px" }}>콜러</th>
              <th style={{ padding: "5px" }}>관리</th>
            </tr>
          </thead>
          <tbody className="responsive-text">
            {records.map((r) => (
              <tr key={r.id} onClick={() => setSelectedRecord(r)}>
                <td style={{ padding: "5px" }}>{r.date || ""}</td>
                <td style={{ padding: "5px" }}>{r.sheetName}</td>
                <td style={{ padding: "5px" }}>
                  {r.time || "정보 없음"} UTC
                  {r.time && (
                    <div style={{ color: "#00d4ff", fontSize: "0.85em" }}>
                      {(() => {
                        const timeParts = String(r.time).split(":");
                        const hours = parseInt(timeParts[0]);
                        const minutes =
                          timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
                        if (isNaN(hours)) return "";
                        let kstHours = (hours + 9) % 24;
                        return `(한국시간 ${String(kstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")})`;
                      })()}
                    </div>
                  )}
                </td>
                <td style={{ padding: "5px", textAlign: "left" }}>
                  {r.sheetComment?.length > 50
                    ? `${r.sheetComment.substring(0, 50)}...`
                    : r.sheetComment || "-"}
                </td>
                <td style={{ padding: "5px" }}>{r.callerName}</td>
                <td
                  style={{ padding: "5px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(user?.role === "admin" || user?.name === r.callerName) && (
                    <button
                      onClick={(e) => handleDeleteRecord(e, r.id, r.callerName)}
                      className="redBtn"
                    >
                      삭 제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 모바일 카드 뷰 */}
        <div
          className="mobile-only-cards"
          style={{ width: "95%", margin: "10px auto" }}
        >
          {records.map((r) => (
            <div
              key={r.id}
              className="party-card"
              onClick={() => setSelectedRecord(r)}
            >
              <div className="card-header">[ {r.sheetName} ]</div>
              <div className="card-info">날짜: {r.date || ""}</div>
              <div className="card-info">
                집합: {r.time || "정보 없음"} UTC
                {r.time && (
                  <span style={{ color: "#00d4ff", marginLeft: "5px" }}>
                    {(() => {
                      const timeParts = String(r.time).split(":");
                      const hours = parseInt(timeParts[0]);
                      const minutes =
                        timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
                      if (isNaN(hours)) return "";
                      let kstHours = (hours + 9) % 24;
                      return `(한국시간 ${String(kstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")})`;
                    })()}
                  </span>
                )}
              </div>
              <div className="card-info">코멘트: {r.sheetComment || "-"}</div>
              <div className="card-footer">
                <span>콜러: {r.callerName}</span>
                {(user?.role === "admin" || user?.name === r.callerName) && (
                  <button
                    onClick={(e) => handleDeleteRecord(e, r.id, r.callerName)}
                    className="redBtn"
                  >
                    삭 제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div
            className="login-modal"
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#222",
              padding: "20px", // 패딩 추가 권장
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              style={{
                position: "absolute", // 3. 절대 위치
                top: "10px",
                right: "20px",
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "40px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              &times;
            </button>
            <h2>{selectedRecord.sheetName} 상세 시트</h2>
            {/* 추가된 규칙 텍스트 */}
            <div
              className="responsive-text"
              style={{
                padding: "10px",
                background: "#444",
                borderRadius: "5px",
                color: "#fff",
                borderLeft: "4px solid #ffcc00", // 강조를 위한 왼쪽 테두리
              }}
            >
              <strong
                className="responsive-text"
                style={{
                  fontWeight: "bold",
                  color: "#ffcc00", // 기존 #ffcc00보다 더 밝은 노란색으로 변경 가능
                }}
              >
                [시트지 사용 방법]
              </strong>
              <br />
              관리자, 콜러는 모든 칸에 입력과 삭제가 가능합니다.
              <br />
              맴버는 확인 버튼을 눌러 한 칸에만 입력이 가능하고,
              <br /> 다른 칸에 다시 입력하려면 삭제 후 다시 확인 버튼을
              눌러주세요.
              <br />
              <br />
              4.4, 5.3등 가격을 확인 후 저렴한 가격의 장비를 입어주세요.
              <br /> 같은 부위의 장비가 2개인 경우 콜러에게 문의 해주세요.
              <br />
              이미지에 마우스를 잠시 올려두면 장비의 이름이 나옵니다.
            </div>
            {/* 1. 상단 정보 표시부 */}
            <div
              className="responsive-text"
              style={{
                padding: "10px",
                background: "#333",
                borderRadius: "5px",
                display: "flex", // Flexbox 사용
                flexWrap: "wrap", // 화면이 작아지면 줄바꿈
                gap: "10px", // 항목 간의 간격
                alignItems: "center",
              }}
            >
              <p style={{ margin: 0, color: "#ffcc00" }}>
                작성자: {selectedRecord.callerName || "알 수 없음"}
              </p>
              <p>
                집합 시간: {selectedRecord.time || "정보 없음"} (UTC)
                {selectedRecord.time && (
                  <span
                    style={{
                      color: "#00d4ff",
                      marginLeft: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    {(() => {
                      // 시간만 입력된 경우("16")와 시간:분("16:00") 모두 대응
                      const timeParts = String(selectedRecord.time).split(":");
                      const hours = parseInt(timeParts[0]);
                      const minutes =
                        timeParts.length > 1 ? parseInt(timeParts[1]) : 0;

                      if (isNaN(hours)) return "";

                      // UTC를 KST로 변환 (UTC + 9시간)
                      let kstHours = (hours + 9) % 24;

                      // 포맷팅 (시간:분)
                      const formattedTime = `${String(kstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

                      return `(한국시간 ${formattedTime})`;
                    })()}
                  </span>
                )}
              </p>
              <p>
                무기: {selectedRecord.weaponTier || "-"} | 방어구:{" "}
                {selectedRecord.armorTier || "-"}
              </p>
              {/* 파티별 인원 카운트 표시 */}
              <div style={{ display: "flex", gap: "15px", fontWeight: "bold" }}>
                {(() => {
                  const keys = Object.keys(selectedRecord.sheetContent || {});
                  const pIdxs = [
                    ...new Set(
                      keys
                        .filter((key) => !key.startsWith("locked-"))
                        .map((key) => parseInt(key.split("-")[0]))
                        .filter((n) => !isNaN(n)),
                    ),
                  ].sort((a, b) => a - b);

                  const partyList = pIdxs.length > 0 ? pIdxs : [0];

                  return partyList.map((pIdx) => {
                    // 1. 해당 파티에 존재하는 행 번호들만 추출
                    const rowIndexes = keys
                      .filter((key) => key.startsWith(`${pIdx}-`))
                      .map((key) => parseInt(key.split("-")[1]))
                      .filter((n) => !isNaN(n));

                    // 2. 해당 파티의 총 정원 = (최대 행 번호 + 1)
                    const maxRows =
                      rowIndexes.length > 0 ? Math.max(...rowIndexes) + 1 : 0;

                    // 3. 실제 이름이 입력된 인원 카운트
                    const currentCount = Array.from({ length: maxRows }).filter(
                      (_, r) =>
                        selectedRecord.sheetContent[`${pIdx}-${r}-2`] &&
                        selectedRecord.sheetContent[`${pIdx}-${r}-2`] !== "",
                    ).length;

                    return (
                      <span key={pIdx} style={{ color: "#00d4ff" }}>
                        {pIdx + 1}파티: {currentCount}/{maxRows}명
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
            {/* 추가: 코멘트 표시부 */}
            <div
              className="responsive-text"
              style={{
                marginBottom: "15px",
                padding: "10px",
                background: "#2a2a2a",
                border: "1px solid #444",
                borderRadius: "5px",
                color: "#eee",
                textAlign: "left",
              }}
            >
              <strong style={{ color: "red" }}>[코멘트]</strong>
              <span style={{ margin: "5px", whiteSpace: "pre-wrap" }}>
                {selectedRecord.sheetComment || "등록된 코멘트가 없습니다."}
              </span>
            </div>
            {showCommentModal && (
              <div
                className="modal-overlay"
                onClick={() => setShowCommentModal(null)}
              >
                <div
                  className="login-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 style={{ margin: "10px" }}>무기 정보</h4>
                  <div
                    style={
                      {
                        /* 스타일 */
                      }
                    }
                  >
                    <p style={{ margin: "10px 0", fontSize: "16px" }}>
                      {comment}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      justifyContent: "center",
                    }}
                  >
                    <button className="sheetBtn" onClick={handleFinalConfirm}>
                      확 인
                    </button>
                    <button
                      className="redBtn"
                      onClick={() => setShowCommentModal(null)}
                    >
                      닫 기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedRecord.sheetContent && (
              <div style={{ width: "100%" }}>
                {(() => {
                  const keys = Object.keys(selectedRecord.sheetContent || {});
                  const pIdxs = [
                    ...new Set(
                      keys
                        .filter((key) => !key.startsWith("locked-"))
                        .map((key) => parseInt(key.split("-")[0]))
                        .filter((n) => !isNaN(n)),
                    ),
                  ].sort((a, b) => a - b);

                  const partyList = pIdxs.length > 0 ? pIdxs : [0];

                  return partyList.map((pIdx) => {
                    // 해당 파티의 데이터가 있는 최대 행 번호를 찾음
                    const rowsInParty = keys
                      .filter((key) => key.startsWith(`${pIdx}-`))
                      .map((key) => parseInt(key.split("-")[1]))
                      .filter((n) => !isNaN(n));

                    const rowCount =
                      rowsInParty.length > 0 ? Math.max(...rowsInParty) + 1 : 1;

                    return (
                      <div key={pIdx} style={{ marginBottom: "30px" }}>
                        {partyList.length > 1 && (
                          <h3
                            style={{
                              color: "#ffcc00",
                              textAlign: "left",
                              margin: "0",
                              padding: "10px",
                            }}
                          >
                            {pIdx + 1} 파티
                          </h3>
                        )}
                        <div className="desktop-only-table">
                          <table
                            border="1"
                            style={{
                              borderCollapse: "collapse",
                              color: "white",
                              width: "100%",
                              border: "2px solid #fff",
                              tableLayout: "fixed",
                            }}
                          >
                            <colgroup>
                              <col style={{ width: "100px" }} />
                              <col style={{ width: "80px" }} />
                              <col style={{ width: "120px" }} />
                              <col style={{ width: "200px" }} />
                              {Array.from({ length: 14 }).map((_, i) => (
                                <col key={i} style={{ width: "60px" }} />
                              ))}
                            </colgroup>
                            <thead>
                              <tr
                                style={{
                                  background: "#333",
                                  fontSize: "12px",
                                  border: "2px solid #fff",
                                }}
                              >
                                {headers.map((h, i) => (
                                  <th
                                    key={i}
                                    colSpan={h.span}
                                    style={{
                                      width: h.span === 2 ? "100px" : "50px",
                                    }}
                                  >
                                    {h.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: rowCount }).map((_, r) => {
                                const isLocked =
                                  !!selectedRecord.sheetContent[
                                    `locked-${pIdx}-${r}`
                                  ];
                                const rowName =
                                  selectedRecord.sheetContent[
                                    `${pIdx}-${r}-2`
                                  ] || "";
                                const isAdminOrCaller =
                                  user?.role === "admin" ||
                                  user?.role === "caller";
                                const isMyRow = rowName === user?.name;
                                const canConfirm = !isLocked;
                                const canDelete =
                                  isLocked && (isAdminOrCaller || isMyRow);

                                return (
                                  <tr key={`${pIdx}-${r}`}>
                                    <td
                                      style={{
                                        border: "1px solid #333",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "57px",
                                      }}
                                    >
                                      {canConfirm && (
                                        <button
                                          onClick={() =>
                                            handleInitiateConfirm(pIdx, r)
                                          }
                                          className="sheetBtn"
                                        >
                                          참 여
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => handleUnlock(pIdx, r)}
                                          className="redBtn"
                                        >
                                          삭 제
                                        </button>
                                      )}
                                    </td>
                                    {Array.from({ length: 17 }).map((_, c) => {
                                      const cellKey = `${pIdx}-${r}-${c}`;
                                      const value =
                                        selectedRecord.sheetContent[cellKey] ||
                                        "";
                                      const cleanVal = value
                                        .split("(")[0]
                                        .trim();
                                      const isAdminOrCaller =
                                        user?.role === "admin" ||
                                        user?.role === "caller";
                                      const isInputEnabled =
                                        !isLocked &&
                                        (c === 1 || c === 2) &&
                                        isAdminOrCaller;
                                      return (
                                        <td
                                          key={c}
                                          style={{
                                            border: "1px solid #555",
                                            textAlign: "center",
                                          }}
                                        >
                                          {isInputEnabled ? (
                                            <input
                                              value={value}
                                              onChange={(e) =>
                                                handleInputChange(
                                                  pIdx,
                                                  r,
                                                  c,
                                                  e.target.value,
                                                )
                                              }
                                              style={{
                                                width: "90%",
                                                background: "#444",
                                                color: "white",
                                                border: "none",
                                              }}
                                            />
                                          ) : colCategoryMap[c] &&
                                            (itemImages[colCategoryMap[c]]?.[
                                              cleanVal
                                            ] ||
                                              value === "미정") ? ( // 2. cleanVal 사용
                                            <img
                                              src={
                                                value === "미정"
                                                  ? unKnown
                                                  : itemImages[
                                                      colCategoryMap[c]
                                                    ][cleanVal] // 3. cleanVal 사용
                                              }
                                              alt={cleanVal} // 4. 접근성을 위해 정제된 이름 사용
                                              title={value} // 5. 툴팁에는 괄호가 포함된 원본 value 그대로 표시
                                              style={{
                                                width: "50px",
                                                height: "50px",
                                                verticalAlign: "middle",
                                                cursor: "help",
                                              }}
                                            />
                                          ) : (
                                            <span
                                              style={{
                                                fontSize: "14px",
                                                fontWeight: "bold",
                                                height: "57px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              {value}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div
                          className="mobile-only-cards"
                          style={{ display: "none" }}
                        >
                          {Array.from({ length: rowCount }).map((_, r) => {
                            const isLocked =
                              !!selectedRecord.sheetContent[
                                `locked-${pIdx}-${r}`
                              ];
                            const isAdminOrCaller =
                              user?.role === "admin" || user?.role === "caller";
                            const getVal = (idx) =>
                              selectedRecord.sheetContent[
                                `${pIdx}-${r}-${idx}`
                              ] || "";

                            const renderItems = (indices, catName) => {
                              return indices.map((idx) => {
                                const val = getVal(idx);
                                if (!val) return null;

                                // '미정'일 경우 unKnown 이미지 반환
                                if (val === "미정") {
                                  return (
                                    <img
                                      key={idx}
                                      src={unKnown}
                                      alt="미정"
                                      title="미정"
                                      style={{
                                        width: "35px",
                                        height: "35px",
                                        borderRadius: "4px",
                                        background: "#333",
                                      }}
                                    />
                                  );
                                }
                                const cleanVal = val.split("(")[0].trim();
                                const imgUrl = itemImages[catName]?.[cleanVal];
                                return imgUrl ? (
                                  <img
                                    key={idx}
                                    src={imgUrl}
                                    alt={val}
                                    title={val}
                                    style={{
                                      width: "35px",
                                      height: "35px",
                                      borderRadius: "4px",
                                      background: "#333",
                                    }}
                                  />
                                ) : (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: "12px",
                                      color: "#fff",
                                      padding: "2px",
                                    }}
                                  >
                                    {val}
                                  </span>
                                );
                              });
                            };

                            return (
                              <div
                                key={r}
                                style={{
                                  background: "#2a2a2a",
                                  padding: "10px",
                                  marginBottom: "10px",
                                  borderRadius: "8px",
                                  border: "1px solid #444",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "8px",
                                  }}
                                >
                                  <strong
                                    style={{
                                      fontSize: "16px",
                                      color: "#ffcc00",
                                    }}
                                  >
                                    {r + 1}번 슬롯
                                  </strong>
                                  {!isLocked ? (
                                    <button
                                      className="sheetBtn"
                                      onClick={() =>
                                        handleInitiateConfirm(pIdx, r)
                                      }
                                    >
                                      참 여
                                    </button>
                                  ) : (
                                    isAdminOrCaller && (
                                      <button
                                        className="redBtn"
                                        onClick={() => handleUnlock(pIdx, r)}
                                      >
                                        삭 제
                                      </button>
                                    )
                                  )}
                                </div>

                                {/* 1. 롤/길드/이름 */}
                                <div
                                  style={{
                                    fontSize: "13px",
                                    color: "#ccc",
                                    marginBottom: "10px",
                                    display: "flex",
                                    gap: "6px",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {/* c = 0 (직책/역할) */}
                                  <span>{getVal(0) || "직책"}</span> |
                                  {/* c = 1 (길드 등) - 관리자/콜러일 경우 모바일에서도 input 수정 지원 */}
                                  {!isLocked && isAdminOrCaller ? (
                                    <input
                                      value={getVal(1)}
                                      onChange={(e) =>
                                        handleInputChange(
                                          pIdx,
                                          r,
                                          1,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="길드"
                                      style={{
                                        width: "60px",
                                        background: "#444",
                                        color: "white",
                                        border: "none",
                                      }}
                                    />
                                  ) : (
                                    <span>{getVal(1) || "-"}</span>
                                  )}{" "}
                                  |
                                  {/* c = 2 (이름 등) - 관리자/콜러일 경우 모바일에서도 input 수정 지원 */}
                                  {!isLocked && isAdminOrCaller ? (
                                    <input
                                      value={getVal(2)}
                                      onChange={(e) =>
                                        handleInputChange(
                                          pIdx,
                                          r,
                                          2,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="이름"
                                      style={{
                                        width: "70px",
                                        background: "#444",
                                        color: "white",
                                        border: "none",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        color: getVal(2) ? "#fff" : "#ffcc00",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {getVal(2) || "참여 가능"}
                                    </span>
                                  )}
                                </div>

                                {/* 2. 장비 영역 (2단 그리드) */}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "10px",
                                    marginBottom: "10px",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontSize: "10px",
                                        color: "#888",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      무기/보조
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "2px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {renderItems([3], "weapons")}
                                      {renderItems([4], "OffHand")}
                                    </div>
                                  </div>
                                  <div>
                                    <div
                                      style={{
                                        fontSize: "10px",
                                        color: "#888",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      방어구
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "2px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {renderItems([5, 6], "Helmet")}
                                      {renderItems([7, 8], "Armor")}
                                      {renderItems([9, 10], "Shoes")}
                                    </div>
                                  </div>
                                </div>

                                {/* 3. 기타 영역 (줄바꿈) */}
                                <div style={{ marginBottom: "10px" }}>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#888",
                                      marginBottom: "2px",
                                    }}
                                  >
                                    케이프 / 푸드 / 포션
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "4px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {renderItems([11, 12], "Cape")}
                                    {renderItems([13, 14], "Food")}
                                    {renderItems([15, 16], "Potion")}
                                  </div>
                                </div>

                                {/* 4. 코멘트 */}
                                {getVal(17) && (
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      background: "#1a1a1a",
                                      padding: "6px",
                                      borderRadius: "4px",
                                      color: "#aaa",
                                    }}
                                  >
                                    {getVal(17)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sheet;
