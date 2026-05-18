import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { useAnnotationStore } from "../../store/annotationStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

const POSITIONS = [
  { value: "top-left",      label: "上左" },
  { value: "top-center",    label: "上中央" },
  { value: "top-right",     label: "上右" },
  { value: "bottom-left",   label: "下左" },
  { value: "bottom-center", label: "下中央" },
  { value: "bottom-right",  label: "下右" },
] as const;

const FORMAT_EXAMPLES = [
  "{n}",
  "- {n} -",
  "Page {n} of {total}",
  "{n} / {total}",
];

export function PageNumbersDialog() {
  const isOpen = useUiStore(s => s.openDialog === "pageNumbers");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, filePath, numPages } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();

  const [format, setFormat] = useState("{n}");
  const [position, setPosition] = useState("bottom-center");
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState(20);
  const [color, setColor] = useState("#000000");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const close = useCallback(() => {
    setDialogOpen(null);
    setStatus(null);
  }, [setDialogOpen]);

  const handleApply = useCallback(async () => {
    if (!originalBytes || !filePath) return;
    setBusy(true);
    setStatus(null);
    try {
      const newBytes = await invoke<number[]>("add_header_footer_pdf", {
        bytes: Array.from(originalBytes),
        options: {
          text: format,
          font_size: fontSize,
          color,
          position,
          margin,
          pages: null,
        },
      });
      clearAnnotations();
      await loadFromBytes(new Uint8Array(newBytes), filePath);
      setStatus(`${numPages} ページにページ番号を追加しました`);
      setTimeout(close, 1500);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, format, fontSize, color, position, margin, numPages, clearAnnotations, loadFromBytes, close]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="ページ番号を追加">
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>フォーマット</label>
          <input
            type="text"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {FORMAT_EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setFormat(ex)}
                style={{ ...presetBtnStyle, background: format === ex ? "var(--accent)" : "var(--bg-primary)", color: format === ex ? "#fff" : "var(--text-primary)" }}>
                {ex}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {"{n}"} = ページ番号、{"{total}"} = 総ページ数
          </p>
        </div>

        <div>
          <label style={labelStyle}>位置</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {POSITIONS.map((p) => (
              <button key={p.value} onClick={() => setPosition(p.value)}
                style={{ ...presetBtnStyle, background: position === p.value ? "var(--accent)" : "var(--bg-primary)", color: position === p.value ? "#fff" : "var(--text-primary)" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>フォントサイズ: {fontSize}pt</label>
            <input type="range" min={8} max={24} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>マージン: {margin}pt</label>
            <input type="range" min={5} max={60} value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              style={{ width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>色</label>
            <input type="color" value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 48, height: 32, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }} />
          </div>
        </div>

        {status && (
          <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e", margin: 0 }}>
            {status}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={handleApply}
            disabled={busy || !format.trim() || !originalBytes}
            style={{ ...actionBtnStyle, opacity: busy || !format.trim() || !originalBytes ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : `全ページに追加 (${numPages}ページ)`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 13,
  background: "var(--bg-primary)", border: "1px solid var(--border)",
  borderRadius: 4, color: "var(--text-primary)", boxSizing: "border-box",
};
const presetBtnStyle: React.CSSProperties = {
  padding: "3px 8px", fontSize: 11, borderRadius: 3, cursor: "pointer",
  border: "1px solid var(--border)",
};
