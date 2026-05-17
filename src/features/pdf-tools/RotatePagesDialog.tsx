import { useState, useCallback } from "react";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { rotatePdfPages } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function RotatePagesDialog() {
  const { rotateDialogOpen, setRotateDialogOpen } = useUiStore();
  const { originalBytes, filePath, numPages } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();
  const [rotations, setRotations] = useState<Map<number, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => { setRotateDialogOpen(false); setRotations(new Map()); }, [setRotateDialogOpen]);

  const rotate = useCallback((pageIdx: number, delta: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      const current = next.get(pageIdx) ?? 0;
      next.set(pageIdx, (current + delta + 360) % 360);
      return next;
    });
  }, []);

  const rotatAll = useCallback((delta: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      for (let i = 0; i < numPages; i++) {
        const current = next.get(i) ?? 0;
        next.set(i, (current + delta + 360) % 360);
      }
      return next;
    });
  }, [numPages]);

  const handleApply = useCallback(async () => {
    if (!originalBytes || !filePath) return;
    const nonZero = new Map([...rotations].filter(([, r]) => r !== 0));
    if (nonZero.size === 0) { close(); return; }
    setBusy(true);
    try {
      const newBytes = await rotatePdfPages(originalBytes, nonZero);
      clearAnnotations();
      await loadFromBytes(newBytes, filePath);
      close();
    } catch (err) {
      console.error("Rotate failed:", err);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, rotations, clearAnnotations, loadFromBytes, close]);

  const pages = Array.from({ length: numPages }, (_, i) => i);

  return (
    <Dialog isOpen={rotateDialogOpen} onClose={close} title="ページ回転" width={380}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => rotatAll(90)} style={allBtnStyle}>全ページ 90° 右回転</button>
          <button onClick={() => rotatAll(-90)} style={allBtnStyle}>全ページ 90° 左回転</button>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {pages.map((i) => {
            const rot = rotations.get(i) ?? 0;
            return (
              <div key={i} style={rowStyle}>
                <span style={{ flex: 1, fontSize: 13 }}>ページ {i + 1}</span>
                <span style={{ fontSize: 11, color: rot !== 0 ? "var(--accent)" : "var(--text-muted)", minWidth: 36, textAlign: "right" }}>
                  {rot !== 0 ? `${rot}°` : "—"}
                </span>
                <button onClick={() => rotate(i, -90)} style={iconBtnStyle} title="90° 左回転">↺</button>
                <button onClick={() => rotate(i, 90)} style={iconBtnStyle} title="90° 右回転">↻</button>
                <button onClick={() => rotate(i, 180)} style={iconBtnStyle} title="180° 反転">⤢</button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setRotations(new Map())} style={cancelBtnStyle}>リセット</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
            <button onClick={handleApply} disabled={busy} style={{ ...actionBtnStyle, opacity: busy ? 0.5 : 1 }}>
              {busy ? "処理中..." : "適用"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const allBtnStyle: React.CSSProperties = { flex: 1, padding: "5px 8px", fontSize: 11, borderRadius: 4, cursor: "pointer", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", background: "var(--bg-primary)", borderRadius: 4, border: "1px solid var(--border)" };
const iconBtnStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, padding: "2px 5px" };
