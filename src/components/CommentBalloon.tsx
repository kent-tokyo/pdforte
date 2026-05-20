import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUiStore } from "../store/uiStore";
import { useAnnotationStore } from "../store/annotationStore";

export function CommentBalloon() {
  const { commentBalloon, setCommentBalloon } = useUiStore();
  const annotations = useAnnotationStore(s => s.annotations);
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation);
  const balloonRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  // Load existing comment when balloon opens
  useEffect(() => {
    if (!commentBalloon) return;
    let existing = "";
    for (const anns of annotations.values()) {
      const found = anns.find(a => a.id === commentBalloon.annotationId);
      if (found) { existing = found.comment ?? ""; break; }
    }
    setText(existing);
  }, [commentBalloon?.annotationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!commentBalloon) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setCommentBalloon(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [commentBalloon, setCommentBalloon]);

  if (!commentBalloon) return null;

  const balloonW = 256;
  const balloonH = 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.min(commentBalloon.x, vw - balloonW - 4);
  const y = Math.min(commentBalloon.y, vh - balloonH - 4);

  const handleSave = () => {
    updateAnnotation(commentBalloon.annotationId, { comment: text.trim() || undefined });
    setCommentBalloon(null);
  };

  return createPortal(
    <div
      ref={balloonRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: balloonW,
        background: "var(--bg-toolbar)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        zIndex: 9999,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>コメント</div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
        rows={3}
        style={{
          width: "100%",
          resize: "none",
          padding: "4px 6px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          borderRadius: 3,
          fontSize: 12,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
        <button onClick={() => setCommentBalloon(null)} style={btnStyle}>キャンセル</button>
        <button onClick={handleSave} style={{ ...btnStyle, background: "var(--accent)", color: "#fff", border: "none" }}>保存</button>
      </div>
    </div>,
    document.body
  );
}

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 3,
  cursor: "pointer",
  background: "transparent",
  color: "var(--text-primary)",
};
