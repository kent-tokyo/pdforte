import React, { useRef, useState, useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import type { StampAnnotation as STA } from "./annotationTypes";
import { useAnnotationActions } from "./useAnnotationActions";
import { screenRectToPdf } from "./annotationUtils";

interface Props {
  annotation: STA;
  screenPos: { left: number; top: number; width: number; height: number };
  viewport: PageViewport;
  isSelected: boolean;
}

export function StampAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { updateAnnotation, deleteAnnotation, setSelectedId } = useAnnotationActions();
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const [pos, setPos] = useState(screenPos);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedId(annotation.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: pos.left, origTop: pos.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [annotation.id, pos, setSelectedId]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ ...pos, left: pos.left + (e.clientX - dragRef.current.startX), top: pos.top + (e.clientY - dragRef.current.startY) });
    dragRef.current = { ...dragRef.current, startX: e.clientX, startY: e.clientY };
  }, [pos]);

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    updateAnnotation(annotation.id, { pdfRect: screenRectToPdf(pos, viewport) });
  }, [annotation.id, pos, viewport, updateAnnotation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete") deleteAnnotation(annotation.id);
  }, [annotation.id, deleteAnnotation]);

  return (
    <div
      className="annotation-item"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: pos.left, top: pos.top,
        width: pos.width, height: pos.height,
        border: isSelected ? "1.5px solid #1473e6" : "none",
        cursor: "move",
        opacity: annotation.opacity,
      }}
    >
      <img src={annotation.dataUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} draggable={false} />
    </div>
  );
}
