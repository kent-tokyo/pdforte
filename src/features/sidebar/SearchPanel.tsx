import { usePdfStore } from "../../store/pdfStore";
import { useSearch } from "./useSearch";

export function SearchPanel() {
  const pdfDoc = usePdfStore(s => s.pdfDoc);
  const { query, setQuery, results, isSearching, currentResultIdx, setCurrentResultIdx, search, navigate } = useSearch(pdfDoc);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.shiftKey) navigate(-1);
      else if (results.length > 0 && currentResultIdx >= 0) navigate(1);
      else search();
    }
  };

  if (!pdfDoc) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>PDFを開いてください</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: 8, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) { search(""); } }}
            onKeyDown={handleKey}
            placeholder="検索... (Enter で検索)"
            autoFocus
            style={{
              flex: 1,
              padding: "5px 8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: 4,
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={() => search()}
            disabled={isSearching || !query.trim()}
            style={{
              padding: "5px 10px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {isSearching ? "…" : "検索"}
          </button>
        </div>

        {results.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>
              {currentResultIdx + 1} / {results.length} 件
            </span>
            <button onClick={() => navigate(-1)} style={navBtnStyle} title="前の結果 (Shift+Enter)">↑</button>
            <button onClick={() => navigate(1)} style={navBtnStyle} title="次の結果 (Enter)">↓</button>
          </div>
        )}
        {!isSearching && query && results.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>見つかりませんでした</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {results.map((r, i) => (
          <div
            key={i}
            onClick={() => { setCurrentResultIdx(i); }}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: "1px solid var(--border)",
              background: i === currentResultIdx ? "var(--bg-secondary)" : "transparent",
              borderLeft: i === currentResultIdx ? "3px solid var(--accent)" : "3px solid transparent",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 2, fontWeight: 600 }}>
              p.{r.pageNumber}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.5, wordBreak: "break-all" }}>
              {r.excerpt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
