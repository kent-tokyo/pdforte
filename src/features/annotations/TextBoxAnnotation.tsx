import React, { useRef, useState, useCallback, useEffect } from "react";
import type { PageViewport } from "pdfjs-dist";
import type { TextBoxAnnotation as TBA } from "./annotationTypes";
import { useAnnotationActions } from "./useAnnotationActions";
import { screenRectToPdf } from "./annotationUtils";

type Dir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type ScreenRect = { left: number; top: number; width: number; height: number };

const HANDLE_STYLE: Record<Dir, React.CSSProperties> = {
  nw: { top: -4, left: -4,                        cursor: "nw-resize" },
  n:  { top: -4, left: "calc(50% - 4px)",          cursor: "n-resize" },
  ne: { top: -4, right: -4,                        cursor: "ne-resize" },
  e:  { top: "calc(50% - 4px)", right: -4,         cursor: "e-resize" },
  se: { bottom: -4, right: -4,                     cursor: "se-resize" },
  s:  { bottom: -4, left: "calc(50% - 4px)",       cursor: "s-resize" },
  sw: { bottom: -4, left: -4,                      cursor: "sw-resize" },
  w:  { top: "calc(50% - 4px)", left: -4,          cursor: "w-resize" },
};

const DIRS: Dir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function applyResize(dir: Dir, orig: ScreenRect, dx: number, dy: number): ScreenRect {
  let { left, top, width, height } = orig;
  if (dir.includes("e")) width  = Math.max(40, orig.width  + dx);
  if (dir.includes("s")) height = Math.max(8, orig.height + dy);
  if (dir.includes("w")) { left = orig.left + dx; width  = Math.max(40, orig.width  - dx); }
  if (dir.includes("n")) { top  = orig.top  + dy; height = Math.max(8, orig.height - dy); }
  return { left, top, width, height };
}

interface Props {
  annotation: TBA;
  screenPos: ScreenRect;
  viewport: PageViewport;
  isSelected: boolean;
}

export function TextBoxAnnotation({ annotation, screenPos, viewport, isSelected }: Props) {
  const { updateAnnotation, deleteAnnotation, setSelectedId } = useAnnotationActions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rect, setRect] = useState<ScreenRect>(screenPos);

  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    origRect: ScreenRect;
    dir?: Dir;
  } | null>(null);

  // Sync store position into local rect when no gesture is active
  useEffect(() => {
    if (!isDragging.current && !isResizing.current) {
      setRect(screenPos);
    }
  }, [screenPos]);

  useEffect(() => {
    if (isSelected) textareaRef.current?.focus();
  }, [isSelected]);

  const confirm = useCallback(() => setSelectedId(null), [setSelectedId]);

  // ── Drag (move) ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setSelectedId(annotation.id);
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.classList.contains("resize-handle")) return;

      isDragging.current = true;
      gestureRef.current = { startX: e.clientX, startY: e.clientY, origRect: rect };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [annotation.id, rect, setSelectedId]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || !isDragging.current) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    setRect({ ...g.origRect, left: g.origRect.left + dx, top: g.origRect.top + dy });
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g || !isDragging.current) return;
      isDragging.current = false;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const newRect = { ...g.origRect, left: g.origRect.left + dx, top: g.origRect.top + dy };
      gestureRef.current = null;
      updateAnnotation(annotation.id, { pdfRect: screenRectToPdf(newRect, viewport) });
    },
    [annotation.id, viewport, updateAnnotation]
  );

  // ── Resize ───────────────────────────────────────────────────────────────
  const handleResizeDown = useCallback(
    (e: React.PointerEvent, dir: Dir) => {
      e.stopPropagation();
      isResizing.current = true;
      gestureRef.current = { startX: e.clientX, startY: e.clientY, origRect: rect, dir };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rect]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent, dir: Dir) => {
    const g = gestureRef.current;
    if (!g || !isResizing.current || g.dir !== dir) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    setRect(applyResize(dir, g.origRect, dx, dy));
  }, []);

  const handleResizeUp = useCallback(
    (e: React.PointerEvent, dir: Dir) => {
      const g = gestureRef.current;
      if (!g || !isResizing.current || g.dir !== dir) return;
      isResizing.current = false;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const newRect = applyResize(dir, g.origRect, dx, dy);
      gestureRef.current = null;
      updateAnnotation(annotation.id, { pdfRect: screenRectToPdf(newRect, viewport) });
    },
    [annotation.id, viewport, updateAnnotation]
  );

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); confirm(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        deleteAnnotation(annotation.id);
      }
    },
    [annotation.id, confirm, deleteAnnotation]
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") { e.preventDefault(); textareaRef.current?.blur(); confirm(); }
    },
    [confirm]
  );

  const cssFontSize = annotation.fontSize * viewport.scale;

  return (
    <div
      className={`annotation-item textbox-annotation${isSelected ? " textbox-selected" : ""}`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 40),
        height: Math.max(rect.height, 8),
        background: annotation.bgColor || "rgba(255,255,255,0.9)",
        cursor: "move",
        userSelect: "none",
        boxShadow: isSelected ? "0 0 0 2px rgba(20,115,230,0.25)" : "none",
      }}
    >
      {/* Mini toolbar */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: -30,
            left: 0,
            display: "flex",
            gap: 2,
            background: "#1473e6",
            borderRadius: "4px 4px 0 0",
            padding: "2px 6px",
            whiteSpace: "nowrap",
            zIndex: 10,
            alignItems: "center",
          }}
        >
          <button onClick={(e) => { e.stopPropagation(); confirm(); }} title="確定 (Esc)" style={miniBtnStyle}>✓ 確定</button>
          <Divider />
          <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(annotation.id); }} title="削除" style={miniBtnStyle}>🗑</button>
          <Divider />
          {/* Font family */}
          <select
            value={annotation.fontFamily ?? "sans-serif"}
            onChange={(e) => updateAnnotation(annotation.id, { fontFamily: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            title="フォント"
            style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 2, padding: "1px 2px", cursor: "pointer" }}
          >
            <option value="sans-serif">Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Mono</option>
            <option value='"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif'>ゴシック</option>
            <option value='"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif'>明朝</option>
          </select>
          {/* Font size */}
          <input
            type="number"
            value={annotation.fontSize}
            min={6} max={144}
            onChange={(e) => updateAnnotation(annotation.id, { fontSize: parseInt(e.target.value) || 12 })}
            onPointerDown={(e) => e.stopPropagation()}
            title="フォントサイズ"
            style={{ width: 36, fontSize: 10, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", textAlign: "center", borderRadius: 2, padding: "1px 2px" }}
          />
          <Divider />
          {/* Bold */}
          <button
            onClick={(e) => { e.stopPropagation(); updateAnnotation(annotation.id, { bold: !annotation.bold }); }}
            title="太字"
            style={{ ...miniBtnStyle, fontWeight: "bold", background: annotation.bold ? "rgba(255,255,255,0.25)" : "transparent" }}
          >B</button>
          {/* Italic */}
          <button
            onClick={(e) => { e.stopPropagation(); updateAnnotation(annotation.id, { italic: !annotation.italic }); }}
            title="斜体"
            style={{ ...miniBtnStyle, fontStyle: "italic", background: annotation.italic ? "rgba(255,255,255,0.25)" : "transparent" }}
          >I</button>
          <Divider />
          {/* Font color */}
          <label title="文字色" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 10, color: "#fff", marginRight: 2 }}>A</span>
            <input
              type="color"
              value={annotation.fontColor}
              onChange={(e) => updateAnnotation(annotation.id, { fontColor: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 18, height: 16, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </label>
          {/* Bg color */}
          <label title="背景色" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 10, color: "#fff", marginRight: 2 }}>bg</span>
            <input
              type="color"
              value={annotation.bgColor || "#ffffff"}
              onChange={(e) => updateAnnotation(annotation.id, { bgColor: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 18, height: 16, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </label>
          {annotation.bgColor && (
            <button
              onClick={(e) => { e.stopPropagation(); updateAnnotation(annotation.id, { bgColor: "" }); }}
              title="背景色をクリア"
              style={{ ...miniBtnStyle, fontSize: 9, opacity: 0.8 }}
            >✕bg</button>
          )}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={annotation.content}
        onChange={(e) => updateAnnotation(annotation.id, { content: e.target.value })}
        onKeyDown={handleTextareaKeyDown}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "transparent",
          resize: "none",
          outline: "none",
          fontSize: cssFontSize,
          fontFamily: annotation.fontFamily ?? "sans-serif",
          color: annotation.fontColor,
          fontWeight: annotation.bold ? "bold" : "normal",
          fontStyle: annotation.italic ? "italic" : "normal",
          lineHeight: 1,
          padding: 0,
          margin: 0,
          cursor: "text",
          boxSizing: "border-box",
        }}
        placeholder="テキストを入力..."
      />

      {/* 8 resize handles (visible only when selected) */}
      {isSelected && DIRS.map((dir) => (
        <div
          key={dir}
          className="resize-handle"
          style={HANDLE_STYLE[dir]}
          onPointerDown={(e) => handleResizeDown(e, dir)}
          onPointerMove={(e) => handleResizeMove(e, dir)}
          onPointerUp={(e) => handleResizeUp(e, dir)}
        />
      ))}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.3)", margin: "0 2px" }} />;
}

const miniBtnStyle: React.CSSProperties = { background: "transparent", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", padding: "1px 4px", borderRadius: 3 };
