import { useState, useRef, useCallback, useEffect } from "react";
import type { PageViewport } from "pdfjs-dist";
import type { StickyNoteAnnotation as SNAnn } from "./annotationTypes";
import { useAnnotationActions } from "./useAnnotationActions";
import { screenRectToPdf } from "./annotationUtils";

interface Props {
  annotation: SNAnn;
  screenPos: { left: number; top: number; width: number; height: number };
  viewport: PageViewport;
  isSelected: boolean;
}

const NOTE_ICON_SIZE = 24;

export function StickyNoteAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { updateAnnotation, deleteAnnotation, setSelectedId } = useAnnotationActions();
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ left: screenPos.left, top: screenPos.top });
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; origLeft: number; origTop: number } | null>(null);

  useEffect(() => {
    if (!isDragging.current) {
      setPos({ left: screenPos.left, top: screenPos.top });
    }
  }, [screenPos.left, screenPos.top]);

  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedId(annotation.id);
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, origLeft: pos.left, origTop: pos.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [annotation.id, pos, setSelectedId]);

  const handleIconPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ left: dragStart.current.origLeft + dx, top: dragStart.current.origTop + dy });
  }, []);

  const handleIconPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const wasDrag = Math.abs(e.clientX - dragStart.current.x) > 3 || Math.abs(e.clientY - dragStart.current.y) > 3;
    isDragging.current = false;
    const newPdfRect = screenRectToPdf(
      { left: pos.left, top: pos.top, width: NOTE_ICON_SIZE, height: NOTE_ICON_SIZE },
      viewport
    );
    updateAnnotation(annotation.id, { pdfRect: newPdfRect });
    if (!wasDrag) setExpanded((v) => !v);
    dragStart.current = null;
  }, [annotation.id, pos, viewport, updateAnnotation]);

  return (
    <>
      {/* Sticky note icon */}
      <div
        className="annotation-item"
        onPointerDown={handleIconPointerDown}
        onPointerMove={handleIconPointerMove}
        onPointerUp={handleIconPointerUp}
        style={{
          position: "absolute",
          left: pos.left,
          top: pos.top,
          width: NOTE_ICON_SIZE,
          height: NOTE_ICON_SIZE,
          background: annotation.color,
          borderRadius: 3,
          cursor: "move",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          boxShadow: isSelected ? `0 0 0 2px rgba(20,115,230,0.5)` : "0 1px 3px rgba(0,0,0,0.3)",
          userSelect: "none",
          zIndex: 10,
        }}
        title="付箋 (クリックで展開)"
      >
        📝
      </div>

      {/* Expanded popup */}
      {expanded && (
        <div
          className="annotation-item"
          style={{
            position: "absolute",
            left: pos.left + NOTE_ICON_SIZE + 4,
            top: pos.top - 10,
            width: 200,
            background: annotation.color,
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            zIndex: 100,
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", background: "rgba(0,0,0,0.12)" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>📌 付箋</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAnnotation(annotation.id); }}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: "#666" }}
              >🗑</button>
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#666" }}
              >✕</button>
            </div>
          </div>
          <textarea
            value={annotation.content}
            onChange={(e) => updateAnnotation(annotation.id, { content: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="メモを入力..."
            style={{
              width: "100%",
              height: 120,
              border: "none",
              background: "transparent",
              resize: "none",
              outline: "none",
              fontSize: 12,
              padding: "6px 8px",
              color: "#222",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </>
  );
}
