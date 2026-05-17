import React, { useRef, useCallback, useState, useEffect } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationStore } from "../../store/annotationStore";
import { pdfRectToScreen, screenRectToPdf } from "./annotationUtils";
import { TextBoxAnnotation } from "./TextBoxAnnotation";
import { HighlightAnnotation } from "./HighlightAnnotation";
import { SignatureAnnotation } from "./SignatureAnnotation";
import { StampAnnotation } from "./StampAnnotation";
import { StickyNoteAnnotation } from "./StickyNoteAnnotation";
import { CalloutAnnotation } from "./CalloutAnnotation";
import { ShapeAnnotation } from "./ShapeAnnotation";
import { PencilAnnotation } from "./PencilAnnotation";
import { ImageAnnotation } from "./ImageAnnotation";
import { getPendingImageData, clearPendingImageData } from "./pendingImage";

interface Props {
  pageIndex: number;
  viewport: PageViewport;
}

const SHAPE_TOOLS = new Set(["shape-rect", "shape-ellipse", "shape-line", "shape-arrow"]);
const PENCIL_TOOL = "pencil";
const POLYGON_TOOL = "shape-polygon";

export function AnnotationLayer({ pageIndex, viewport }: Props) {
  const { annotations, activeTool, addAnnotation, setSelectedId, selectedId } = useAnnotationStore();
  const layerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  // Pencil state
  const pencilActive = useRef(false);
  const pencilScreenPts = useRef<[number, number][]>([]);
  const [pencilPreview, setPencilPreview] = useState<[number, number][] | null>(null);
  // Polygon state
  const [polygonPts, setPolygonPts] = useState<[number, number][] | null>(null);
  const [polygonCursor, setPolygonCursor] = useState<[number, number] | null>(null);

  const pageAnnotations = annotations.get(pageIndex) ?? [];

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "select" || activeTool === "hand") return;
      if ((e.target as HTMLElement).closest(".annotation-item")) return;

      const layer = layerRef.current;
      if (!layer) return;

      const rect = layer.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (activeTool === PENCIL_TOOL) {
        pencilActive.current = true;
        pencilScreenPts.current = [[px, py]];
        setPencilPreview([[px, py]]);
        layer.setPointerCapture(e.pointerId);
        return;
      }

      // Polygon: single click adds vertex, right-click closes
      if (activeTool === POLYGON_TOOL) {
        if (e.button === 2) {
          // right-click: finalize
          finalizePolygon();
          return;
        }
        setPolygonPts((prev) => {
          const next = prev ? [...prev, [px, py] as [number, number]] : [[px, py] as [number, number]];
          return next;
        });
        return;
      }

      dragStart.current = { x: px, y: py };
    },
    [activeTool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const layer = layerRef.current;
      if (!layer) return;
      const rect = layer.getBoundingClientRect();

      if (activeTool === PENCIL_TOOL && pencilActive.current) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        pencilScreenPts.current.push([px, py]);
        if (pencilScreenPts.current.length % 4 === 0) {
          setPencilPreview([...pencilScreenPts.current]);
        }
        return;
      }

      if (activeTool === POLYGON_TOOL) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setPolygonCursor([px, py]);
        return;
      }

      if (!dragStart.current || !SHAPE_TOOLS.has(activeTool)) return;
      setPreview({
        sx: dragStart.current.x,
        sy: dragStart.current.y,
        ex: e.clientX - rect.left,
        ey: e.clientY - rect.top,
      });
    },
    [activeTool]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Pencil finish
      if (activeTool === PENCIL_TOOL && pencilActive.current) {
        pencilActive.current = false;
        const pts = pencilScreenPts.current;
        pencilScreenPts.current = [];
        setPencilPreview(null);

        if (pts.length < 2) return;

        const pdfPoints: [number, number][] = pts.map(([sx, sy]) => {
          const [px, py] = viewport.convertToPdfPoint(sx, sy);
          return [px, py];
        });

        const xs = pdfPoints.map(([x]) => x);
        const ys = pdfPoints.map(([, y]) => y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);

        addAnnotation({
          type: "pencil",
          pageIndex,
          pdfRect: { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 },
          points: pdfPoints,
          color: "#000000",
          strokeWidth: 2,
          opacity: 1,
        });
        return;
      }

      // Image placement
      if (activeTool === "image-add") {
        const dataUrl = getPendingImageData();
        clearPendingImageData();
        if (!dataUrl) return;
        if (!dragStart.current) return;
        const layer2 = layerRef.current;
        if (!layer2) return;
        const rect2 = layer2.getBoundingClientRect();
        const ex = e.clientX - rect2.left;
        const ey = e.clientY - rect2.top;
        const { x: sx, y: sy } = dragStart.current;
        dragStart.current = null;
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        const scRect = {
          left: Math.min(sx, ex),
          top: Math.min(sy, ey),
          width: w > 10 ? w : 200,
          height: h > 10 ? h : 150,
        };
        const pdfRect = screenRectToPdf(scRect, viewport);
        addAnnotation({ type: "image", pageIndex, pdfRect, dataUrl, opacity: 1 });
        return;
      }

      if (!dragStart.current) return;
      const layer = layerRef.current;
      if (!layer) return;

      const rect = layer.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      const start = dragStart.current;
      dragStart.current = null;

      const screenRect = {
        left: Math.min(start.x, endX),
        top: Math.min(start.y, endY),
        width: Math.abs(endX - start.x),
        height: Math.abs(endY - start.y),
      };

      const isClick = screenRect.width < 5 && screenRect.height < 5;

      if (isClick) {
        if (activeTool === "textbox") {
          screenRect.width = 200;
          screenRect.height = 40;
        } else if (activeTool === "stickynote") {
          screenRect.width = 24;
          screenRect.height = 24;
        } else if (activeTool === "callout") {
          screenRect.width = 160;
          screenRect.height = 48;
        } else {
          setPreview(null);
          return;
        }
      }

      setPreview(null);
      const pdfRect = screenRectToPdf(screenRect, viewport);

      if (SHAPE_TOOLS.has(activeTool)) {
        const shapeKind = activeTool.replace("shape-", "") as "rect" | "ellipse" | "line" | "arrow";
        const base = {
          type: "shape" as const,
          shape: shapeKind,
          pageIndex,
          pdfRect,
          strokeColor: "#e34850",
          fillColor: "",
          strokeWidth: 2,
          opacity: 1,
        };
        if (shapeKind === "line" || shapeKind === "arrow") {
          const [x1, y1] = viewport.convertToPdfPoint(start.x, start.y);
          const [x2, y2] = viewport.convertToPdfPoint(endX, endY);
          addAnnotation({ ...base, x1, y1, x2, y2 });
        } else {
          addAnnotation(base);
        }
        return;
      }

      if (activeTool === "textbox") {
        addAnnotation({
          type: "textbox",
          pageIndex,
          pdfRect,
          content: "",
          fontSize: 12,
          fontColor: "#000000",
          bgColor: "",
          bold: false,
          italic: false,
          lang: "ja",
        });
      } else if (activeTool === "stickynote") {
        addAnnotation({
          type: "stickynote",
          pageIndex,
          pdfRect,
          content: "",
          color: "#FFD700",
        });
      } else if (activeTool === "callout") {
        // Tail defaults to below-right of box
        const tailScreenX = screenRect.left + screenRect.width + 40;
        const tailScreenY = screenRect.top + screenRect.height + 30;
        const [tailPdfX, tailPdfY] = viewport.convertToPdfPoint(tailScreenX, tailScreenY);
        addAnnotation({
          type: "callout",
          pageIndex,
          pdfRect,
          content: "",
          color: "#FFF9C4",
          fontSize: 12,
          tailPdfX,
          tailPdfY,
        });
      }
    },
    [activeTool, viewport, pageIndex, addAnnotation]
  );

  const finalizePolygon = useCallback(() => {
    setPolygonPts((pts) => {
      if (!pts || pts.length < 3) return null;
      const pdfPoints: [number, number][] = pts.map(([sx, sy]) => {
        const [px, py] = viewport.convertToPdfPoint(sx, sy);
        return [px, py];
      });
      const xs = pdfPoints.map(([x]) => x);
      const ys = pdfPoints.map(([, y]) => y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      addAnnotation({
        type: "shape",
        shape: "polygon",
        pageIndex,
        pdfRect: { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 },
        points: pdfPoints,
        strokeColor: "#e34850",
        fillColor: "",
        strokeWidth: 2,
        opacity: 1,
      });
      return null;
    });
    setPolygonCursor(null);
  }, [viewport, pageIndex, addAnnotation]);

  // Cancel pencil/polygon/pending-image on tool switch
  useEffect(() => {
    pencilActive.current = false;
    pencilScreenPts.current = [];
    setPencilPreview(null);
    setPolygonPts(null);
    setPolygonCursor(null);
    clearPendingImageData();
  }, [activeTool]);

  const handleLayerClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".annotation-item")) return;
      setSelectedId(null);
    },
    [setSelectedId]
  );

  return (
    <div
      ref={layerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleLayerClick}
      onContextMenu={(e) => { if (activeTool === POLYGON_TOOL) e.preventDefault(); }}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents:
          activeTool === "highlight" ||
          activeTool === "underline" ||
          activeTool === "strikethrough" ||
          activeTool === "select"
            ? "none"
            : "auto",
        cursor:
          activeTool === "hand"
            ? "grab"
            : activeTool === "textbox" || activeTool === "select"
            ? "text"
            : activeTool === "pencil"
            ? "crosshair"
            : "crosshair",
        userSelect: "none",
      }}
    >
      {pageAnnotations.map((ann) => {
        const screenPos = pdfRectToScreen(ann.pdfRect, viewport);
        const isSelected = ann.id === selectedId;

        if (ann.type === "textbox") {
          return (
            <TextBoxAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "highlight" || ann.type === "underline" || ann.type === "strikethrough") {
          return (
            <HighlightAnnotation
              key={ann.id}
              annotation={ann}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "signature") {
          return (
            <SignatureAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "stamp") {
          return (
            <StampAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "stickynote") {
          return (
            <StickyNoteAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "callout") {
          return (
            <CalloutAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "shape") {
          return (
            <ShapeAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "pencil") {
          return (
            <PencilAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              viewport={viewport}
              isSelected={isSelected}
            />
          );
        }
        if (ann.type === "image") {
          return (
            <ImageAnnotation
              key={ann.id}
              annotation={ann}
              screenPos={screenPos}
              isSelected={isSelected}
            />
          );
        }
        return null;
      })}

      {/* Live drag preview for shape tools */}
      {preview && SHAPE_TOOLS.has(activeTool) && (
        <svg
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none", overflow: "visible",
          }}
        >
          <ShapePreviewEl
            tool={activeTool}
            sx={preview.sx} sy={preview.sy}
            ex={preview.ex} ey={preview.ey}
          />
        </svg>
      )}

      {/* Polygon live preview */}
      {activeTool === POLYGON_TOOL && polygonPts && polygonPts.length > 0 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {/* Existing edges */}
          {polygonPts.length > 1 && (
            <polyline
              points={polygonPts.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none" stroke="#0078D7" strokeWidth={2} strokeDasharray="6 3" opacity={0.85}
            />
          )}
          {/* Edge to cursor */}
          {polygonCursor && (
            <line
              x1={polygonPts[polygonPts.length - 1][0]}
              y1={polygonPts[polygonPts.length - 1][1]}
              x2={polygonCursor[0]} y2={polygonCursor[1]}
              stroke="#0078D7" strokeWidth={2} strokeDasharray="6 3" opacity={0.85}
            />
          )}
          {/* Closing edge hint (first pt → cursor) when ≥ 3 pts */}
          {polygonPts.length >= 3 && polygonCursor && (
            <line
              x1={polygonPts[0][0]} y1={polygonPts[0][1]}
              x2={polygonCursor[0]} y2={polygonCursor[1]}
              stroke="#0078D7" strokeWidth={1} strokeDasharray="3 4" opacity={0.4}
            />
          )}
          {/* Vertex dots */}
          {polygonPts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="#0078D7" opacity={0.85} />
          ))}
          {/* "Right-click to close" hint */}
          {polygonPts.length >= 3 && (
            <text x={polygonPts[0][0] + 8} y={polygonPts[0][1] - 8} fontSize={11} fill="#0078D7" opacity={0.8}>
              右クリックで確定
            </text>
          )}
        </svg>
      )}

      {/* Pencil live preview */}
      {pencilPreview && pencilPreview.length > 1 && (
        <svg
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none", overflow: "visible",
          }}
        >
          <path
            d={"M " + pencilPreview.map(([x, y]) => `${x},${y}`).join(" L ")}
            fill="none"
            stroke="#000000"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        </svg>
      )}
    </div>
  );
}

function ShapePreviewEl({ tool, sx, sy, ex, ey }: {
  tool: string; sx: number; sy: number; ex: number; ey: number;
}) {
  const x = Math.min(sx, ex), y = Math.min(sy, ey);
  const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
  const style = { fill: "none", stroke: "#0078D7", strokeWidth: 2, strokeDasharray: "6 3", opacity: 0.85 };

  if (tool === "shape-rect") {
    return <rect x={x} y={y} width={w} height={h} {...style} />;
  }
  if (tool === "shape-ellipse") {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...style} />;
  }
  if (tool === "shape-line") {
    return <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#0078D7" strokeWidth={2} strokeDasharray="6 3" opacity={0.85} />;
  }
  if (tool === "shape-arrow") {
    const dx = ex - sx, dy = ey - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const nx = dx / len, ny = dy / len;
    const as_ = 14, wg = 5;
    const ax = ex - nx * as_ - ny * wg, ay = ey - ny * as_ + nx * wg;
    const bx = ex - nx * as_ + ny * wg, by = ey - ny * as_ - nx * wg;
    return (
      <>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#0078D7" strokeWidth={2} strokeDasharray="6 3" opacity={0.85} />
        <polygon points={`${ex},${ey} ${ax},${ay} ${bx},${by}`} fill="#0078D7" opacity={0.85} />
      </>
    );
  }
  return null;
}
