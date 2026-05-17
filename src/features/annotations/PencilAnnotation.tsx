import { useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationActions } from "./useAnnotationActions";
import type { PencilAnnotation as PencilAnn } from "./annotationTypes";

interface Props {
  annotation: PencilAnn;
  screenPos: { left: number; top: number; width: number; height: number };
  viewport: PageViewport;
  isSelected: boolean;
}

export function PencilAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { setSelectedId, deleteAnnotation } = useAnnotationActions();

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteAnnotation(annotation.id);
    }
  }, [annotation, deleteAnnotation]);

  // Convert each PDF coordinate point to screen coordinates relative to container top-left
  const screenPoints = annotation.points.map(([px, py]) => {
    const [sx, sy] = viewport.convertToViewportPoint(px, py);
    return [sx - screenPos.left, sy - screenPos.top] as [number, number];
  });

  const d = screenPoints.length > 1
    ? "M " + screenPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ")
    : "";

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
        outline: isSelected ? "2px dashed #0078D7" : "none",
        outlineOffset: 4,
        pointerEvents: "auto",
        cursor: "pointer",
      }}
    >
      <svg
        style={{ position: "absolute", overflow: "visible", width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <path
          d={d}
          fill="none"
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth * viewport.scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={annotation.opacity}
        />
      </svg>
    </div>
  );
}
