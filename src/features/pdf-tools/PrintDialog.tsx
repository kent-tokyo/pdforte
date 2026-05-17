import { useState, useCallback } from "react";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog } from "../../components/Dialog";

type Orientation = "portrait" | "landscape";
type PageSize = "A4" | "A3" | "Letter" | "Legal";

const PAGE_SIZES: Record<PageSize, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A3:     { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal:  { w: 215.9, h: 355.6 },
};

export function PrintDialog() {
  const { printDialogOpen, setPrintDialogOpen } = useUiStore();
  const { numPages, currentPage } = usePdfStore();

  const [pageMode, setPageMode] = useState<"all" | "current" | "range">("all");
  const [rangeInput, setRangeInput] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [copies, setCopies] = useState(1);

  const handleClose = () => setPrintDialogOpen(false);

  const handlePrint = useCallback(() => {
    const { w, h } = PAGE_SIZES[pageSize];
    const cssW = orientation === "portrait" ? `${w}mm` : `${h}mm`;
    const cssH = orientation === "portrait" ? `${h}mm` : `${w}mm`;

    // ページ範囲のCSS生成
    let rangeStyle = "";
    if (pageMode === "current") {
      const p = currentPage;
      rangeStyle = `@page { size: ${cssW} ${cssH}; } .pdf-page-wrapper:not(:nth-child(${p})) { display: none !important; }`;
    } else if (pageMode === "range" && rangeInput.trim()) {
      // 範囲外のページを非表示にするCSSを生成
      const included = new Set<number>();
      for (const part of rangeInput.split(",")) {
        const [a, b] = part.trim().split("-").map(Number);
        if (b) { for (let p = a; p <= b; p++) if (p >= 1 && p <= numPages) included.add(p); }
        else if (a >= 1 && a <= numPages) included.add(a);
      }
      const hidden = Array.from({ length: numPages }, (_, i) => i + 1).filter((p) => !included.has(p));
      const hiddenSelectors = hidden.map((p) => `.pdf-page-wrapper:nth-child(${p})`).join(", ");
      rangeStyle = `@page { size: ${cssW} ${cssH}; } ${hiddenSelectors ? `${hiddenSelectors} { display: none !important; }` : ""}`;
    } else {
      rangeStyle = `@page { size: ${cssW} ${cssH}; }`;
    }

    const styleEl = document.createElement("style");
    styleEl.id = "__print_range_style__";
    styleEl.textContent = rangeStyle;
    document.head.appendChild(styleEl);

    // 部数ループ
    for (let c = 0; c < copies; c++) {
      window.print();
    }

    // クリーンアップ
    setTimeout(() => {
      document.getElementById("__print_range_style__")?.remove();
    }, 1000);

    handleClose();
  }, [pageMode, currentPage, rangeInput, numPages, pageSize, orientation, copies]);

  return (
    <Dialog isOpen={printDialogOpen} onClose={handleClose} title="🖨 印刷" width={420}>
      <div style={{ padding: 24 }}>
        {/* Page range */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>印刷ページ</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {(["all", "current", "range"] as const).map((m) => (
              <button key={m} onClick={() => setPageMode(m)} style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 12, cursor: "pointer", border: "none",
                background: pageMode === m ? "var(--accent)" : "var(--bg-tertiary)",
                color: pageMode === m ? "#fff" : "var(--text-primary)",
              }}>
                {m === "all" ? "すべて" : m === "current" ? `現在 (${currentPage})` : "範囲指定"}
              </button>
            ))}
          </div>
          {pageMode === "range" && (
            <input
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="例: 1-3, 5, 8-10"
              style={inputStyle}
            />
          )}
        </div>

        {/* Page size */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>用紙サイズ</label>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} style={inputStyle}>
            {(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Orientation */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>向き</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["portrait", "landscape"] as const).map((o) => (
              <button key={o} onClick={() => setOrientation(o)} style={{
                padding: "4px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer", border: "none",
                background: orientation === o ? "var(--accent)" : "var(--bg-tertiary)",
                color: orientation === o ? "#fff" : "var(--text-primary)",
              }}>
                {o === "portrait" ? "縦（ポートレート）" : "横（ランドスケープ）"}
              </button>
            ))}
          </div>
        </div>

        {/* Copies */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>部数</label>
          <input
            type="number" min={1} max={99}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ ...inputStyle, width: 80 }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={handleClose} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handlePrint} style={confirmBtnStyle}>🖨 印刷</button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };
const cancelBtnStyle: React.CSSProperties = { padding: "8px 20px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 };
const confirmBtnStyle: React.CSSProperties = { padding: "8px 20px", borderRadius: 4, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
