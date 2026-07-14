import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Caller.css";
import SearchableSelect from "./SearchableSelect";
import { db } from "./firebase/firebase";
import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

const Caller = ({ user, checkAndLogout }) => {
  const [showCreateModal, setShowCreateModal] = useState(false); // 생성 팝업 상태
  const [sheetConfig, setSheetConfig] = useState(null); // 시트지 데이터 (행/열/이름)
  // Caller 컴포넌트 내부에 상태 추가
  const [itemLists, setItemLists] = useState({
    weapons: [],
    OffHand: [],
    Helmet: [],
    Armor: [],
    Shoes: [],
    Cape: [],
    Food: [],
    Potion: [],
  });
  const [cellImages, setCellImages] = useState({}); // { "파티-행-열": "이미지URL" }
  const [sheetData, setSheetData] = useState({}); // { "pIdx-r-c": value }
  const [mySheets, setMySheets] = useState([]);
  const [presets, setPresets] = useState([]); // 프리셋 상태 추가
  const [combinedWeaponList, setCombinedWeaponList] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSheetForUpload, setSelectedSheetForUpload] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyCaller = async () => {
      // Caller는 'caller' 권한(또는 admin)이 필요함
      const isTampered = await checkAndLogout("caller");

      // 변조되었으면 checkAndLogout 내부에서 로그아웃 처리가 되므로
      // 여기서는 이동만 막으면 됩니다.
      if (isTampered) {
        navigate("/");
      }
    };

    verifyCaller();
  }, [checkAndLogout, navigate]);

  // 열에 대한 너비 설정 (단위: px)
  // 병합된 열(Helmet~Potion)은 2개 칸을 차지하므로 너비를 넉넉히 잡습니다.
  const colWidths = [
    "70px", // Roll
    "300px", // Comment
    "200px", // Weapon
    "160px", // Off-Hand
    "160px", // Helmet (2칸)
    "160px",
    "160px", // Armor (2칸)
    "160px",
    "160px", // Shoes (2칸)
    "160px",
    "180px", // Cape (2칸)
    "180px",
    "230px", // Food (2칸)
    "230px",
    "150px", // Potion (2칸)
    "150px",
    "100px", //프리셋 저장
  ];

  const colCategoryMap = {
    2: "weapons", // 2번 인덱스부터 아이템 시작
    3: "OffHand",
    4: "Helmet",
    5: "Helmet",
    6: "Armor",
    7: "Armor",
    8: "Shoes",
    9: "Shoes",
    10: "Cape",
    11: "Cape",
    12: "Food",
    13: "Food",
    14: "Potion",
    15: "Potion",
  };
  // 무기 데이터 로드
  useEffect(() => {
    const fetchAllItems = async () => {
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
      const newLists = {};

      for (const cat of categories) {
        const snap = await getDoc(doc(db, cat, "list"));
        if (snap.exists()) {
          const data = snap.data();
          newLists[cat] = Object.keys(data)
            .map((key) => ({
              name: key,
              url: data[key],
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
        } else {
          newLists[cat] = [];
        }
      }
      setItemLists(newLists);
    };
    fetchAllItems();
  }, []);

  // 컴포넌트 마운트 시 프리셋 로드
  useEffect(() => {
    const fetchPresets = async () => {
      const q = query(
        collection(db, "presets"),
        where("callerName", "==", user.name),
      );
      const querySnapshot = await getDocs(q);
      setPresets(
        querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    };
    if (user?.name) fetchPresets();
  }, [user]);

  useEffect(() => {
    if (Object.keys(itemLists).length === 0) return;

    const newCombinedLists = {};
    const categories = Object.keys(itemLists); // weapons, OffHand, 등

    categories.forEach((cat) => {
      // 1. 해당 카테고리 아이템
      const items = itemLists[cat].map((item) => ({
        ...item,
        type: "item",
      }));

      // 2. 프리셋 (모든 카테고리에서 프리셋을 선택할 수 있게 함)
      const presetItems = presets.map((p) => ({
        name: p.name,
        url: null,
        type: "preset",
        data: p.data,
      }));

      newCombinedLists[cat] = [...items, ...presetItems].sort((a, b) =>
        a.name.localeCompare(b.name, "ko-KR"),
      );
    });

    setCombinedWeaponList(newCombinedLists);
  }, [itemLists, presets]);

  //콜러의 시트 목록을 가져오는 함수
  useEffect(() => {
    const fetchMySheets = async () => {
      // 디버깅: user 정보와 name이 제대로 넘어오는지 확인
      console.log("현재 유저 정보:", user);

      if (!user?.name) {
        console.log("user.name이 없습니다.");
        return;
      }

      try {
        const sheetsRef = collection(db, "sheets");
        const q = query(sheetsRef, where("callerName", "==", user.name));
        const querySnapshot = await getDocs(q);

        // 디버깅: 문서 개수 확인
        console.log("가져온 문서 개수:", querySnapshot.size);

        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMySheets(list);
      } catch (e) {
        console.error("시트 목록 로드 실패:", e);
      }
    };

    fetchMySheets();
  }, [user]);

  // 시트 목록을 새로 가져오는 함수
  const fetchMySheets = async () => {
    if (!user?.name) return;
    try {
      const sheetsRef = collection(db, "sheets");
      const q = query(sheetsRef, where("callerName", "==", user.name));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMySheets(list);
    } catch (e) {
      console.error("시트 목록 로드 실패:", e);
    }
  };

  // 시트 선택 클릭 핸들러 (이 부분을 수정하세요)
  const loadSheet = (sheet) => {
    setSheetConfig({
      name: sheet.sheetName,
      rows: sheet.rowCount,
      id: sheet.id,
    });
    setSheetData(sheet.data || {});
    // cellImages 처리는 useEffect로 이관
  };
  useEffect(() => {
    if (!sheetConfig || !sheetData) return;

    const newCellImages = {};
    Object.keys(sheetData).forEach((key) => {
      const [pIdx, r, c] = key.split("-");
      const catKey = colCategoryMap[c];

      if (catKey && itemLists[catKey]) {
        const itemName = sheetData[key];
        const item = itemLists[catKey].find((i) => i.name === itemName);
        if (item?.url) {
          newCellImages[key] = item.url;
        }
      }
    });
    setCellImages(newCellImages);
  }, [sheetData, itemLists, sheetConfig]); // 데이터나 아이템 목록이 준비되면 실행

  // 저장 함수
  const saveSheet = async () => {
    try {
      if (sheetConfig.id) {
        // 기존 시트 수정 로직
        const docRef = doc(db, "sheets", sheetConfig.id);
        await updateDoc(docRef, { data: sheetData, updatedAt: new Date() });

        setMySheets((prev) =>
          prev.map((s) =>
            s.id === sheetConfig.id ? { ...s, data: sheetData } : s,
          ),
        );

        alert("수정되었습니다!");
      } else {
        // 신규 시트 저장 로직
        const newSheetData = {
          callerName: user.name,
          sheetName: sheetConfig.name,
          rowCount: sheetConfig.rows,
          data: sheetData,
          createdAt: new Date(),
        };

        const docRef = await addDoc(collection(db, "sheets"), newSheetData);

        // 신규 추가된 시트 정보를 리스트에 반영
        setMySheets((prev) => [...prev, { id: docRef.id, ...newSheetData }]);

        // 저장 후에는 신규 상태를 수정 상태로 변경 (ID 부여)
        setSheetConfig((prev) => ({ ...prev, id: docRef.id }));

        alert("저장되었습니다!");
      }
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장에 실패했습니다.");
    }
  };
  // 다른 이름으로 저장 함수
  const saveAsSheet = async () => {
    const newName = window.prompt(
      "새로운 시트지 이름을 입력하세요:",
      `${sheetConfig.name}_복사본`,
    );
    if (!newName) return;

    try {
      const newSheetData = {
        callerName: user.name,
        sheetName: newName,
        rowCount: sheetConfig.rows,
        data: sheetData, // 현재 화면의 데이터를 그대로 복사
        description: sheetConfig.description || "",
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, "sheets"), newSheetData);

      // 리스트에 추가하고 해당 시트를 불러옴
      setMySheets((prev) => [...prev, { id: docRef.id, ...newSheetData }]);
      setSheetConfig({ name: newName, rows: sheetConfig.rows, id: docRef.id });

      alert("새로운 이름으로 저장되었습니다!");
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장에 실패했습니다.");
    }
  };

  // 시트지 업로드
  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedSheetForUpload) {
      alert("대상 시트지를 먼저 선택해주세요.");
      return;
    }

    const formData = new FormData(e.target);

    // 날짜 데이터 수집
    const year = formData.get("year");
    const month = formData.get("month");
    const day = formData.get("day");
    const dateString = `${year}-${month}-${day}`; // 예: "2026-07-08"

    const rawData = selectedSheetForUpload.data;
    const formattedData = {};

    // 데이터 재배치 로직은 그대로 유지...
    Object.keys(rawData).forEach((key) => {
      const [pIdx, r, c] = key.split("-").map(Number);
      const value = rawData[key];
      if (c === 0) formattedData[`${pIdx}-${r}-0`] = value;
      else if (c === 1) formattedData[`${pIdx}-${r}-17`] = value;
      else if (c >= 2 && c <= 15)
        formattedData[`${pIdx}-${r}-${c + 1}`] = value;
    });

    const rowCount = selectedSheetForUpload.rowCount;
    const partyCount = Math.ceil(rowCount / 20);
    for (let pIdx = 0; pIdx < partyCount; pIdx++) {
      const rowsInParty = Math.min(20, rowCount - pIdx * 20);
      for (let r = 0; r < rowsInParty; r++) {
        formattedData[`${pIdx}-${r}-1`] = "";
        formattedData[`${pIdx}-${r}-2`] = "";
      }
    }

    try {
      await addDoc(collection(db, "records"), {
        callerName: user.name,
        sheetName: selectedSheetForUpload.sheetName,
        sheetId: selectedSheetForUpload.id,
        sheetContent: formattedData,
        date: dateString, // 날짜 필드 추가
        time: formData.get("time"),
        weaponTier: formData.get("weaponTier"),
        armorTier: formData.get("armorTier"),
        sheetComment: formData.get("sheetComment"),
        createdAt: new Date(),
      });
      alert("업로드되었습니다!");
      setShowUploadModal(false);
    } catch (e) {
      console.error("업로드 실패:", e);
      alert("업로드 실패: " + e.message);
    }
  };

  const deleteSheet = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      // 1. Firebase에서 삭제
      await deleteDoc(doc(db, "sheets", sheetConfig.id));

      // 2. 화면에 보여주는 목록에서 즉시 삭제 (새로고침 없이 반영)
      setMySheets((prev) =>
        prev.filter((sheet) => sheet.id !== sheetConfig.id),
      );

      alert("삭제되었습니다.");

      // 3. 시트지 뷰 종료
      setSheetConfig(null);
      setSheetData({});
      setCellImages({});
    } catch (e) {
      console.error("삭제 실패:", e);
      alert("삭제에 실패했습니다.");
    }
  };

  // 시트지 생성 로직
  const handleCreateSheet = async (e) => {
    e.preventDefault();
    const name = e.target.sheetName.value;
    const rows = parseInt(e.target.rowCount.value);
    const description = e.target.description.value;

    try {
      const docRef = await addDoc(collection(db, "sheets"), {
        callerName: user.name,
        sheetName: name,
        rowCount: rows,
        description: description,
        data: {}, // DB에는 빈 데이터 저장
        createdAt: new Date(),
      });

      setSheetConfig({ name, rows, id: docRef.id });
      setSheetData({}); // <--- 이 부분이 핵심: 생성 시 이전 데이터 삭제
      setCellImages({}); // <--- 이전 이미지들도 삭제
      setShowCreateModal(false);
    } catch (e) {
      console.error("생성 실패:", e);
    }
  };
  //프리셋 저장
  const saveEquipmentPreset = async (rowIdx, pIdx) => {
    // 1. 세션 스토리지에서 유저 이름 가져오기
    const storedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
    const userName = storedUser.name || "Unknown";

    // 2. 현재 행의 무기 이름 가져오기 (c=2가 무기 열이라고 가정)
    const weaponName = sheetData[`${pIdx}-${rowIdx}-2`] || "무기없음";

    // 3. 무기이름 + 유저이름 조합으로 프리셋 이름 생성
    const presetName = `${weaponName}(${userName})`;

    // 4. 해당 행의 장비 데이터 추출 (Weapon ~ Potion: 2번~15번 컬럼)
    const equipmentData = {};
    for (let c = 2; c <= 15; c++) {
      const cellKey = `${pIdx}-${rowIdx}-${c}`;
      equipmentData[cellKey] = sheetData[cellKey] || "";
    }

    try {
      const newPreset = {
        callerName: userName,
        name: presetName,
        data: equipmentData,
        createdAt: new Date(),
      };

      // 5. Firebase 저장
      const docRef = await addDoc(collection(db, "presets"), newPreset);

      // 6. 로컬 상태 업데이트
      setPresets([...presets, { id: docRef.id, ...newPreset }]);
      alert(`'${presetName}'으로 저장되었습니다.`);
    } catch (e) {
      console.error("저장 실패:", e);
      alert("저장에 실패했습니다.");
    }
  };

  // 2. 시트지 생성 팝업
  if (showCreateModal) {
    return (
      <div className="modal-overlay">
        <div className="login-modal">
          <form onSubmit={handleCreateSheet} className="login-form">
            <button
              onClick={() => setShowCreateModal(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: "1",
              }}
            >
              &times;
            </button>
            <h2>시트지 생성</h2>
            <input name="sheetName" placeholder="시트지 이름" required />
            <input
              name="rowCount"
              type="number"
              placeholder="행 수(인원)"
              required
            />
            <input name="description" placeholder="시트지 코멘트(설명)" />
            <button className="callerBtn" type="submit">
              다음
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (sheetConfig) {
    const { rows, name } = sheetConfig;
    const headers = [
      "Roll",
      "Comment",
      "Weapon",
      "Off-Hand",
      "Helmet",
      "Armor",
      "Shoes",
      "Cape",
      "Food",
      "Potion",
      "Preset",
    ];
    const partyData = [];
    for (let i = 0; i < rows; i += 20) {
      partyData.push({
        partyName: `${Math.floor(i / 20) + 1}파티`,
        data: [...Array(Math.min(20, rows - i))],
      });
    }

    return (
      <div style={{ margin: "20px 20px 0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <button
              className="callerBtn"
              onClick={() => {
                fetchMySheets();
                setSheetConfig(null);
                setSheetData({}); // 필요 시 데이터 초기화
              }}
            >
              이 전
            </button>
            <button className="callerBtn" onClick={saveSheet}>
              저 장
            </button>
            <button className="callerBtn" onClick={saveAsSheet}>
              다른 이름으로 저장
            </button>
            <button
              onClick={() => {
                setSheetConfig(null);
                setSheetData({}); // 필요 시 데이터 초기화
                setSelectedSheetForUpload({
                  id: sheetConfig.id,
                  sheetName: sheetConfig.name,
                  data: sheetData, // 여기서 현재 수정 중인 sheetData가 들어가는지 확인
                });
                setShowUploadModal(true);
              }}
              className="callerBtn"
            >
              업로드
            </button>
            <button className="redBtn" onClick={deleteSheet}>
              삭 제
            </button>
          </div>
          <h2>{name}</h2>
        </div>
        {partyData.map((party, pIdx) => (
          <div key={pIdx} style={{ marginBottom: "40px" }}>
            <h3>{party.partyName}</h3>
            <div
              style={{
                width: "100%",
                overflowX: "auto", // 가로 스크롤 허용
                overflowY: "auto", // 내용이 길어지면 세로 스크롤도 여기서 발생
                maxHeight: "60vh", // 화면 높이의 60%를 넘으면 내부 스크롤 발생
                border: "1px solid #555",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  color: "white",
                  width: "100%",
                  minWidth: "2690px", // 테이블이 찌그러지지 않도록 최소 너비 지정
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  {colWidths.map((w, index) => (
                    <col key={index} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr style={{ background: "#333" }}>
                    {headers.map((h, i) => (
                      <th
                        key={h}
                        colSpan={i >= 4 ? 2 : 1}
                        style={{
                          fontSize: "16px",
                          border: "1px solid #555",
                          padding: "8px 0",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {party.data.map((_, r) => (
                    <tr key={r}>
                      {Array(19)
                        .fill()
                        .map((_, c) => {
                          const cellKey = `${pIdx}-${r}-${c}`;
                          const catKey = colCategoryMap[c]; // 해당 열의 카테고리 확인
                          const isItemColumn = c >= 2 && c <= 15; // 아이템 카테고리 열 범위 (2~15)

                          // 열에 맞는 리스트 가져오기 (해당 카테고리가 없으면 빈 배열)
                          const currentList = isItemColumn
                            ? combinedWeaponList[catKey] || []
                            : [];

                          return (
                            <td
                              key={c}
                              style={{
                                width: colWidths[c],
                                padding: "4px",
                                border: "1px solid #555",
                              }}
                            >
                              {c === 16 ? (
                                // [마지막 열] 프리셋 저장 버튼
                                <div
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                  }}
                                >
                                  <button
                                    onClick={() => saveEquipmentPreset(r, pIdx)}
                                    className="callerBtn"
                                  >
                                    저 장
                                  </button>
                                </div>
                              ) : c === 0 ? (
                                // [0번 열] Roll 드롭다운
                                <select
                                  value={sheetData[cellKey] || ""}
                                  onChange={(e) =>
                                    setSheetData((prev) => ({
                                      ...prev,
                                      [cellKey]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    background: "#222",
                                    color: "white",
                                  }}
                                >
                                  <option value="">선택</option>
                                  {[
                                    "Call",
                                    "Def",
                                    "Sup",
                                    "Debuf",
                                    "DPS",
                                    "Heal",
                                    "BM",
                                  ].map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : c === 1 ? (
                                // [1번 열] Comment 입력창
                                <input
                                  value={sheetData[cellKey] || ""}
                                  onChange={(e) =>
                                    setSheetData((prev) => ({
                                      ...prev,
                                      [cellKey]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    background: "transparent",
                                    color: "white",
                                    border: "none",
                                  }}
                                  placeholder="코멘트 입력"
                                />
                              ) : isItemColumn ? (
                                // [2~15번 열] 각 카테고리별 SearchableSelect 적용
                                <SearchableSelect
                                  list={currentList} // 해당 열 카테고리 리스트 전달
                                  value={sheetData[cellKey] || ""}
                                  onChange={(selectedName) => {
                                    setSheetData((prev) => ({
                                      ...prev,
                                      [cellKey]: selectedName,
                                    }));
                                  }}
                                />
                              ) : (
                                // [기타 열] 일반 입력
                                <input
                                  value={sheetData[cellKey] || ""}
                                  onChange={(e) =>
                                    setSheetData((prev) => ({
                                      ...prev,
                                      [cellKey]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    background: "transparent",
                                    color: "white",
                                    border: "none",
                                  }}
                                />
                              )}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: "1",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "2rem",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* 콜러 페이지 사용 방법 가이드 박스 */}
      <div
        style={{
          width: "90%",
          maxWidth: "1000px",
          background: "#333",
          margin: "10px",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid #555",
          color: "#ddd",
          fontSize: "20px",
        }}
      >
        <p
          style={{ fontWeight: "bold", color: "#ffcc00", margin: "0 0 10px 0" }}
        >
          [콜러 페이지 사용 방법]
        </p>
        <p>
          <strong>시트지 생성 방법:</strong> 시트지 생성하기 버튼 클릭 후 이름,
          인원수를 입력합니다. 다음 버튼을 눌러 무기/방어구 선택 및 코멘트를
          입력하세요. '저장' 버튼을 클릭하면 내 시트지 목록에 저장됩니다.
        </p>
        <p>
          <strong>시트지 수정, 삭제, 업로드:</strong> 내 시트지 목록에서
          시트지를 클릭하여 수정 후 위쪽 '저장' 버튼을 클릭하세요. 삭제는 '삭제'
          버튼, 멤버들에게 공유하려면 '업로드' 버튼을 클릭합니다. 이전 버튼으로
          목록으로 돌아갈 수 있습니다.
        </p>
        <p>
          <strong>업로드 버튼:</strong> 날짜, 집합시간, 무기티어, 방어구티어,
          푸드티어를 입력하고 업로드하려는 시트지를 선택한 후 업로드하기 버튼을
          클릭합니다.
        </p>
      </div>

      <h2 style={{ margin: "0" }}>환영합니다, {user?.name}님!</h2>

      <button className="callerBtn" onClick={() => setShowCreateModal(true)}>
        시트지 생성하기
      </button>

      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h3 style={{ margin: "10px" }}>내 시트지 목록</h3>
        {mySheets.length > 0 ? (
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            {mySheets.map((sheet) => (
              <div key={sheet.id} style={{ display: "flex", gap: "5px" }}>
                <button className="callerBtn" onClick={() => loadSheet(sheet)}>
                  {sheet.sheetName}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>작성한 시트지가 없습니다.</p>
        )}
        {showUploadModal && (
          <div className="modal-overlay">
            <div className="login-modal">
              <form onSubmit={handleUpload} className="login-form">
                <h4>시트지 데이터 업로드</h4>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    fontSize: "15px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <input
                      name="year"
                      type="number"
                      defaultValue={new Date().getFullYear()}
                      required
                      style={{ width: "70px" }}
                    />
                    년
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <input
                      name="month"
                      type="number"
                      defaultValue={new Date().getMonth() + 1}
                      required
                      style={{ width: "50px" }}
                    />
                    월
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <input
                      name="day"
                      type="number"
                      defaultValue={new Date().getDate()}
                      required
                      style={{ width: "50px" }}
                    />
                    일
                  </span>
                </div>
                <input
                  name="time"
                  type="text"
                  placeholder="집합 시간(UTC) 시간만 입력"
                  required
                />
                <input
                  name="weaponTier"
                  type="text"
                  placeholder="무기 티어"
                  required
                />
                <input
                  name="armorTier"
                  type="text"
                  placeholder="방어구 티어"
                  required
                />
                <input
                  name="sheetComment"
                  type="text"
                  placeholder="시트지 코멘트"
                  required
                />

                <div style={{ margin: "10px 0" }}>
                  <p>대상 시트지 선택:</p>
                  <div
                    style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}
                  >
                    {mySheets.map((sheet) => (
                      <button
                        key={sheet.id}
                        type="button" // 폼 제출 방지
                        onClick={() => setSelectedSheetForUpload(sheet)}
                        style={{
                          background:
                            selectedSheetForUpload?.id === sheet.id
                              ? "#007bff"
                              : "#555",
                          color: "white",
                        }}
                      >
                        {sheet.sheetName}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit">업로드하기</button>
                <button type="button" onClick={() => setShowUploadModal(false)}>
                  취소
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Caller;
