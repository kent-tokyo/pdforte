import type { PageViewport } from "pdfjs-dist";
import type { HighlightAnnotation as HA } from "./annotationTypes";
import { useAnnotationActions } from "./useAnnotationActions";
import { pdfRectToScreen } from "./annotationUtils";

interface Props {
  annotation: HA;
  viewport: PageViewport;
  isSelected: boolean;
}

export function HighlightAnnotation({ annotation, viewport }: Props) {
  const { setSelectedId } = useAnnotationActions();

  return (
    <svg
      className="annotation-item"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {annotation.rects.map((rect, i) => {
        const s = pdfRectToScreen(rect, viewport);
        if (annotation.type === "highlight") {
          return (
            <rect
              key={i}
              x={s.left} y={s.top} width={s.width} height={s.height}
              fill={annotation.color}
              fillOpacity={0.4}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onClick={() => setSelectedId(annotation.id)}
            />
          );
        }
        if (annotation.type === "underline") {
          return (
            <line
              key={i}
              x1={s.left} y1={s.top + s.height}
              x2={s.left + s.width} y2={s.top + s.height}
              stroke={annotation.color} strokeWidth={1.5}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onClick={() => setSelectedId(annotation.id)}
            />
          );
        }
        if (annotation.type === "strikethrough") {
          return (
            <line
              key={i}
              x1={s.left} y1={s.top + s.height / 2}
              x2={s.left + s.width} y2={s.top + s.height / 2}
              stroke={annotation.color} strokeWidth={1.5}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onClick={() => setSelectedId(annotation.id)}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}
