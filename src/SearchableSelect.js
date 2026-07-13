import React, { useState, useEffect } from "react";

const SearchableSelect = ({ list, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || "");
    const [focusedIndex, setFocusedIndex] = useState(-1);

    useEffect(() => {
        setInputValue(value || "");
    }, [value]);

    const filteredList = list.filter((item) =>
        item.name.toLowerCase().includes((isOpen ? inputValue : "").toLowerCase())
    );

    // 선택 로직 통합 (마우스 클릭 및 엔터 키 공통 사용)
    const executeSelect = (item) => {
        if (!item) return;

        // 프리셋 데이터가 있으면 함께 전달
        if (item.type === "preset") {
            onChange(item.name, item.data);
        } else {
            onChange(item.name, null);
        }

        setInputValue(item.name);
        setIsOpen(false);
        setFocusedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Tab") {
            setIsOpen(false);
            onChange(inputValue, null);
            return;
        }

        if (!isOpen) {
            if (e.key === "ArrowDown") setIsOpen(true);
            return;
        }

        if (e.key === "ArrowDown") {
            setFocusedIndex((prev) => (prev < filteredList.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            setFocusedIndex((prev) => (prev > -1 ? prev - 1 : prev));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (focusedIndex >= 0) {
                executeSelect(filteredList[focusedIndex]);
            } else {
                // 포커스된 항목이 없어도 현재 입력값으로 onChange 실행
                onChange(inputValue, null);
                setIsOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
            setFocusedIndex(-1);
        }
    };

    return (
        <div style={{ position: "relative", width: "100%" }}>
            <input
                value={inputValue}
                placeholder="검색/선택"
                onClick={() => setIsOpen(true)}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setIsOpen(true);
                    setFocusedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    setTimeout(() => {
                        setIsOpen(false);
                        onChange(inputValue, null);
                    }, 200);
                }}
                style={{ width: "100%", background: "#222", color: "white", border: "none" }}
            />
            {isOpen && (
                <div style={{ position: "absolute", zIndex: 99, background: "#333", width: "100%", maxHeight: "200px", overflowY: "auto", border: "1px solid #555" }}>
                    {filteredList.map((item, idx) => (
                        <div
                            key={item.name}
                            onMouseDown={() => executeSelect(item)}
                            style={{
                                padding: "5px",
                                cursor: "pointer",
                                color: item.type === "preset" ? "#ffcc00" : "white",
                                background: idx === focusedIndex ? "#555" : "transparent"
                            }}
                        >
                            {item.type === "preset" ? `[P] ${item.name}` : item.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;