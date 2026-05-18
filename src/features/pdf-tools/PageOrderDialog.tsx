import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { reorderPages } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function PageOrderDialog() {
  const isOpen = useUiStore(s => s.openDialog === "pageOrder");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, filePath, numPages } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const initOrder = useCallback(() => {
    setOrder(Array.from({ length: numPages }, (_, i) => i));
  }, [numPages]);

  const close = useCallback(() => {
    setDialogOpen(null);
    setOrder([]);
  }, [setDialogOpen]);

  useEffect(() => {
    if (isOpen && numPages > 0) initOrder();
  }, [isOpen, numPages, initOrder]);

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(idx, 0, item);
      dragIdx.current = idx;
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null;
  }, []);

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((idx: number) => {
    setOrder((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const removePage = useCallback((idx: number) => {
    setOrder((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const insertBlankAfter = useCallback(async (afterListIdx: number) => {
    if (!originalBytes || !filePath) return;
    setBusy(true);
    try {
      // Apply current order first, then insert blank page at the desired position.
      const reordered = await reorderPages(originalBytes, order);
      const withBlank = await invoke<number[]>("insert_blank_page_pdf", {
        bytes: Array.from(reordered),
        after: afterListIdx + 1, // 1-indexed position in reordered doc
      });
      clearAnnotations();
      await loadFromBytes(new Uint8Array(withBlank), filePath);
      close();
    } catch (err) {
      console.error("Insert blank page failed:", err);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, order, clearAnnotations, loadFromBytes, close]);

  const handleApply = useCallback(async () => {
    if (!originalBytes || !filePath || order.length === 0) return;
    setBusy(true);
    try {
      const newBytes = await reorderPages(originalBytes, order);
      clearAnnotations();
      await loadFromBytes(newBytes, filePath);
      close();
    } catch (err) {
      console.error("Page reorder failed:", err);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, order, clearAnnotations, loadFromBytes, close]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="ページの並び替え / 削除" width={380}>
      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          ドラッグまたは矢印で並び替え。✕ でページ削除。＋ でその後に白紙ページを挿入。適用後は注釈がリセットされます。
        </p>

        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {order.map((pageIdx, listIdx) => (
            <div
              key={`${listIdx}-${pageIdx}`}
              draggable
              onDragStart={() => handleDragStart(listIdx)}
              onDragOver={(e) => handleDragOver(e, listIdx)}
              onDragEnd={handleDragEnd}
              style={rowStyle}
            >
              <span style={{ cursor: "grab", color: "var(--text-muted)", fontSize: 14, paddingRight: 4 }}>⠿</span>
              <span style={{ flex: 1, fontSize: 13 }}>ページ {pageIdx + 1}</span>
              <button onClick={() => moveUp(listIdx)} disabled={listIdx === 0} style={iconBtnStyle} title="上へ">▲</button>
              <button onClick={() => moveDown(listIdx)} disabled={listIdx === order.length - 1} style={iconBtnStyle} title="下へ">▼</button>
              <button onClick={() => insertBlankAfter(listIdx)} disabled={busy} style={{ ...iconBtnStyle, color: "#27ae60" }} title="後に白紙を挿入">＋</button>
              <button onClick={() => removePage(listIdx)} style={{ ...iconBtnStyle, color: "#e34850" }} title="削除">✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 12 }}>
          <button onClick={initOrder} style={cancelBtnStyle}>リセット</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
            <button
              onClick={handleApply}
              disabled={busy || order.length === 0}
              style={{ ...actionBtnStyle, opacity: busy || order.length === 0 ? 0.5 : 1 }}
            >
              {busy ? "処理中..." : `適用 (${order.length}ページ)`}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  padding: "6px 8px", background: "var(--bg-primary)", borderRadius: 4,
  border: "1px solid var(--border)", cursor: "grab",
};
const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  color: "var(--text-secondary)", fontSize: 11, padding: "2px 4px",
};
