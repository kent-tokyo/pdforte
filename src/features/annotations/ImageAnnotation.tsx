import { useCallback } from "react";
import { useAnnotationActions } from "./useAnnotationActions";
import type { ImageAnnotation as ImageAnn } from "./annotationTypes";

interface Props {
  annotation: ImageAnn;
  screenPos: { left: number; top: number; width: number; height: number };
  isSelected: boolean;
}

export function ImageAnnotation({ annotation, screenPos, isSelected }: Props) {
  const { setSelectedId, deleteAnnotation } = useAnnotationActions();

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteAnnotation(annotation.id);
    }
  }, [annotation.id, deleteAnnotation]);

  return (
    <div
      className="annotation-item"
      tabIndex={isSelected ? 0 : -1}
      onMouseDown={() => setSelectedId(annotation.id)}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: screenPos.left,
        top: screenPos.top,
        width: screenPos.width,
        height: screenPos.height,
        cursor: "move",
        outline: isSelected ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        opacity: annotation.opacity,
        overflow: "hidden",
      }}
    >
      <img
        src={annotation.dataUrl}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
      />
    </div>
  );
}
