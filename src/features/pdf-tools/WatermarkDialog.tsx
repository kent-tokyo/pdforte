import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { useAnnotationStore } from "../../store/annotationStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function WatermarkDialog() {
  const { watermarkDialogOpen, setWatermarkDialogOpen } = useUiStore();
  const { originalBytes, filePath } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();

  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#808080");
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-45);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const close = useCallback(() => {
    setWatermarkDialogOpen(false);
    setStatus(null);
  }, [setWatermarkDialogOpen]);

  const handleApply = useCallback(async () => {
    if (!originalBytes || !filePath || !text.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const newBytes = await invoke<number[]>("add_watermark_pdf", {
        bytes: Array.from(originalBytes),
        text: text.trim(),
        fontSize,
        color,
        opacity,
        rotation,
        pages: null,
      });
      clearAnnotations();
      await loadFromBytes(new Uint8Array(newBytes), filePath);
      setStatus("ウォーターマークを追加しました");
      setTimeout(close, 1200);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, text, fontSize, color, opacity, rotation, clearAnnotations, loadFromBytes, close]);

  return (
    <Dialog isOpen={watermarkDialogOpen} onClose={close} title="ウォーターマークを追加">
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>テキスト</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            ※ ASCII文字のみ対応（CJKフォントインストール後に日本語対応予定）
          </p>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>フォントサイズ: {fontSize}pt</label>
            <input type="range" min={12} max={120} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>不透明度: {Math.round(opacity * 100)}%</label>
            <input type="range" min={5} max={100} value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              style={{ width: "100%" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>回転角度: {rotation}°</label>
            <input type="range" min={-90} max={0} value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
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
            disabled={busy || !text.trim() || !originalBytes}
            style={{ ...actionBtnStyle, opacity: busy || !text.trim() || !originalBytes ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "全ページに適用"}
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
