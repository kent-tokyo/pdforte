import { useRef, useState, useCallback, useEffect } from "react";
import type { PageViewport } from "pdfjs-dist";
import type { CalloutAnnotation as CAnn } from "./annotationTypes";
import { useAnnotationActions } from "./useAnnotationActions";
import { screenRectToPdf } from "./annotationUtils";

type ScreenRect = { left: number; top: number; width: number; height: number };

interface Props {
  annotation: CAnn;
  screenPos: ScreenRect;
  viewport: PageViewport;
  isSelected: boolean;
}

function nearestEdgePoint(box: ScreenRect, tx: number, ty: number) {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (box.width === 0 || box.height === 0) return { x: cx, y: cy };
  const scaleX = dx !== 0 ? Math.abs(box.width / 2 / dx) : Infinity;
  const scaleY = dy !== 0 ? Math.abs(box.height / 2 / dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function CalloutAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { updateAnnotation, updateAnnotationSilent, deleteAnnotation, setSelectedId } = useAnnotationActions();
  const [rect, setRect] = useState<ScreenRect>(screenPos);
  const [tailScreen, setTailScreen] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const isDraggingTail = useRef(false);
  const gestureRef = useRef<{ startX: number; startY: number; origRect?: ScreenRect; origTail?: { x: number; y: number } } | null>(null);

  // Convert tail PDF coords to screen
  useEffect(() => {
    const [sx, sy] = viewport.convertToViewportPoint(annotation.tailPdfX, annotation.tailPdfY);
    setTailScreen({ x: sx, y: sy });
  }, [annotation.tailPdfX, annotation.tailPdfY, viewport]);

  useEffect(() => {
    if (!isDragging.current && !isDraggingTail.current) {
      setRect(screenPos);
    }
  }, [screenPos]);

  // Box drag
  const handleBoxPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedId(annotation.id);
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    isDragging.current = true;
    gestureRef.current = { startX: e.clientX, startY: e.clientY, origRect: rect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [annotation.id, rect, setSelectedId]);

  const handleBoxPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !gestureRef.current?.origRect) return;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    setRect({ ...gestureRef.current.origRect, left: gestureRef.current.origRect.left + dx, top: gestureRef.current.origRect.top + dy });
  }, []);

  const handleBoxPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !gestureRef.current?.origRect) return;
    isDragging.current = false;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    const newRect = { ...gestureRef.current.origRect, left: gestureRef.current.origRect.left + dx, top: gestureRef.current.origRect.top + dy };
    gestureRef.current = null;
    updateAnnotation(annotation.id, { pdfRect: screenRectToPdf(newRect, viewport) });
  }, [annotation.id, viewport, updateAnnotation]);

  // Tail drag
  const handleTailPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingTail.current = true;
    gestureRef.current = { startX: e.clientX, startY: e.clientY, origTail: { ...tailScreen } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [tailScreen]);

  const handleTailPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingTail.current || !gestureRef.current?.origTail) return;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    setTailScreen({ x: gestureRef.current.origTail.x + dx, y: gestureRef.current.origTail.y + dy });
  }, []);

  const handleTailPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingTail.current || !gestureRef.current?.origTail) return;
    isDraggingTail.current = false;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    const sx = gestureRef.current.origTail.x + dx;
    const sy = gestureRef.current.origTail.y + dy;
    gestureRef.current = null;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(sx, sy);
    updateAnnotation(annotation.id, { tailPdfX: pdfX, tailPdfY: pdfY });
  }, [annotation.id, viewport, updateAnnotation]);

  const edge = nearestEdgePoint(rect, tailScreen.x, tailScreen.y);
  const arrowId = `arrow-${annotation.id}`;
  const cssFontSize = annotation.fontSize * viewport.scale;

  return (
    <>
      {/* SVG arrow overlay (covers entire page, no pointer events) */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 5 }}
      >
        <defs>
          <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={annotation.color} />
          </marker>
        </defs>
        <line
          x1={edge.x} y1={edge.y}
          x2={tailScreen.x} y2={tailScreen.y}
          stroke={annotation.color}
          strokeWidth={2}
          markerEnd={`url(#${arrowId})`}
        />
      </svg>

      {/* Tail drag handle */}
      <div
        className="annotation-item"
        onPointerDown={handleTailPointerDown}
        onPointerMove={handleTailPointerMove}
        onPointerUp={handleTailPointerUp}
        style={{
          position: "absolute",
          left: tailScreen.x - 6,
          top: tailScreen.y - 6,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: annotation.color,
          border: "2px solid white",
          cursor: "move",
          zIndex: 20,
          display: isSelected ? "block" : "none",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        }}
      />

      {/* Text box */}
      <div
        className="annotation-item"
        onPointerDown={handleBoxPointerDown}
        onPointerMove={handleBoxPointerMove}
        onPointerUp={handleBoxPointerUp}
        style={{
          position: "absolute",
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 80),
          height: Math.max(rect.height, 30),
          background: annotation.color,
          border: `1.5px solid ${annotation.color}`,
          borderRadius: 4,
          cursor: "move",
          zIndex: 10,
          boxShadow: isSelected ? "0 0 0 2px rgba(20,115,230,0.25)" : "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >
        {/* Mini toolbar */}
        {isSelected && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: -28,
              left: 0,
              display: "flex",
              gap: 2,
              background: "#1473e6",
              borderRadius: "4px 4px 0 0",
              padding: "2px 4px",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <button onClick={(e) => { e.stopPropagation(); setSelectedId(null); }} style={miniBtnStyle}>✓ 確定</button>
            <div style={{ width: 1, background: "rgba(255,255,255,0.3)", margin: "2px 0" }} />
            <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(annotation.id); }} style={miniBtnStyle}>🗑</button>
            <div style={{ width: 1, background: "rgba(255,255,255,0.3)", margin: "2px 0" }} />
            <input
              type="color"
              value={annotation.color}
              onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 20, height: 18, border: "none", padding: 0, cursor: "pointer", background: "transparent" }}
              title="色を変更"
            />
            <input
              type="number"
              value={annotation.fontSize}
              min={6}
              max={72}
              onChange={(e) => updateAnnotationSilent(annotation.id, { fontSize: parseInt(e.target.value) || 12 })}
              onBlur={(e) => updateAnnotation(annotation.id, { fontSize: parseInt(e.target.value) || 12 })}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 36, fontSize: 10, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", textAlign: "center", borderRadius: 2 }}
              title="フォントサイズ"
            />
          </div>
        )}

        <textarea
          value={annotation.content}
          onChange={(e) => updateAnnotationSilent(annotation.id, { content: e.target.value })}
          onBlur={() => updateAnnotation(annotation.id, { content: annotation.content })}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="吹き出しテキスト..."
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
            resize: "none",
            outline: "none",
            fontSize: cssFontSize,
            color: "#222",
            padding: "4px 6px",
            cursor: "text",
            boxSizing: "border-box",
          }}
        />
      </div>
    </>
  );
}

const miniBtnStyle: React.CSSProperties = { background: "transparent", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", padding: "1px 6px", borderRadius: 3 };
