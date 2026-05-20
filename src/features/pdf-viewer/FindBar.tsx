import { useEffect, useRef } from "react";
import { usePdfStore } from "../../store/pdfStore";
import { useUiStore } from "../../store/uiStore";
import { useSearch } from "../sidebar/useSearch";

export function FindBar() {
  const pdfDoc = usePdfStore(s => s.pdfDoc);
  const { findBarOpen, setFindBarOpen } = useUiStore();
  const { query, setQuery, results, isSearching, currentResultIdx, search, navigate } = useSearch(pdfDoc);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (findBarOpen) inputRef.current?.focus();
  }, [findBarOpen]);

  if (!findBarOpen) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setFindBarOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) navigate(-1);
      else if (results.length > 0 && currentResultIdx >= 0) navigate(1);
      else search();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!e.target.value) search("");
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 16,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-toolbar)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "4px 6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder="検索..."
        style={{
          width: 180,
          padding: "3px 6px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          borderRadius: 3,
          fontSize: 12,
          outline: "none",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40, textAlign: "center" }}>
        {results.length > 0 ? `${currentResultIdx + 1} / ${results.length}` : isSearching ? "…" : ""}
      </span>
      <button onClick={() => navigate(-1)} disabled={results.length === 0} style={navBtnStyle} title="前の結果 (Shift+Enter)">↑</button>
      <button onClick={() => { if (results.length > 0 && currentResultIdx >= 0) navigate(1); else search(); }} style={navBtnStyle} title="次の結果 (Enter)">↓</button>
      <button
        onClick={() => setFindBarOpen(false)}
        style={{ ...navBtnStyle, color: "var(--text-muted)" }}
        title="閉じる (Esc)"
      >✕</button>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
