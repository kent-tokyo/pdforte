import React, { useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationActions } from "./useAnnotationActions";
import type { ShapeAnnotation as ShapeAnn } from "./annotationTypes";

interface Props {
  annotation: ShapeAnn;
  screenPos: { left: number; top: number; width: number; height: number };
  viewport: PageViewport;
  isSelected: boolean;
}

export function ShapeAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { deleteAnnotation, setSelectedId } = useAnnotationActions();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(annotation.id);
  }, [annotation.id, setSelectedId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteAnnotation(annotation.id);
    }
  }, [annotation.id, deleteAnnotation]);

  const { shape, strokeColor, fillColor, strokeWidth, opacity } = annotation;
  const fill = fillColor || "none";

  let svgLeft = screenPos.left;
  let svgTop = screenPos.top;
  let svgWidth = Math.max(screenPos.width, 4);
  let svgHeight = Math.max(screenPos.height, 4);
  let content: React.ReactNode;

  if ((shape === "line" || shape === "arrow") && annotation.x1 !== undefined) {
    const [sx1, sy1] = viewport.convertToViewportPoint(annotation.x1, annotation.y1!);
    const [sx2, sy2] = viewport.convertToViewportPoint(annotation.x2!, annotation.y2!);
    const pad = Math.max(strokeWidth * 2, 12);
    svgLeft = Math.min(sx1, sx2) - pad;
    svgTop = Math.min(sy1, sy2) - pad;
    svgWidth = Math.abs(sx2 - sx1) + pad * 2;
    svgHeight = Math.abs(sy2 - sy1) + pad * 2;
    const lx1 = sx1 - svgLeft;
    const ly1 = sy1 - svgTop;
    const lx2 = sx2 - svgLeft;
    const ly2 = sy2 - svgTop;

    if (shape === "line") {
      content = (
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke={strokeColor} strokeWidth={strokeWidth} />
      );
    } else {
      const dx = lx2 - lx1, dy = ly2 - ly1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        const nx = dx / len, ny = dy / len;
        const as_ = Math.max(12, strokeWidth * 4);
        const wg = as_ * 0.38;
        const ax = lx2 - nx * as_ - ny * wg;
        const ay = ly2 - ny * as_ + nx * wg;
        const bx = lx2 - nx * as_ + ny * wg;
        const by = ly2 - ny * as_ - nx * wg;
        content = (
          <>
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
              stroke={strokeColor} strokeWidth={strokeWidth} />
            <polygon points={`${lx2},${ly2} ${ax},${ay} ${bx},${by}`}
              fill={strokeColor} stroke="none" />
          </>
        );
      } else {
        content = (
          <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
            stroke={strokeColor} strokeWidth={strokeWidth} />
        );
      }
    }
  } else if (shape === "polygon" && annotation.points && annotation.points.length > 1) {
    const screenPts = annotation.points.map(([px, py]) => {
      const [sx, sy] = viewport.convertToViewportPoint(px, py);
      return [sx - svgLeft, sy - svgTop] as [number, number];
    });
    const pointsStr = screenPts.map(([x, y]) => `${x},${y}`).join(" ");
    content = (
      <polygon points={pointsStr}
        fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
    );
  } else if (shape === "rect") {
    const half = strokeWidth / 2;
    content = (
      <rect x={half} y={half}
        width={Math.max(svgWidth - strokeWidth, 1)}
        height={Math.max(svgHeight - strokeWidth, 1)}
        fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
    );
  } else {
    // ellipse
    const rx = Math.max(svgWidth / 2 - strokeWidth / 2, 1);
    const ry = Math.max(svgHeight / 2 - strokeWidth / 2, 1);
    content = (
      <ellipse cx={svgWidth / 2} cy={svgHeight / 2}
        rx={rx} ry={ry}
        fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
    );
  }

  return (
    <div
      className="annotation-item"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: svgLeft,
        top: svgTop,
        width: svgWidth,
        height: svgHeight,
        opacity,
        cursor: "move",
        outline: isSelected ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        borderRadius: undefined,
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: "block", overflow: "visible" }}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </svg>
    </div>
  );
}
