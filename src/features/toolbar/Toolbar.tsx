import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { useUiStore } from "../../store/uiStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { useSavePdf } from "../annotations/useSavePdf";
import { ToolsMenu } from "../pdf-tools/ToolsMenu";
import type { AnnotationTool } from "../annotations/annotationTypes";
import { setPendingImageData } from "../annotations/pendingImage";

const TOOLS: { id: AnnotationTool; label: string; icon: string }[] = [
  { id: "hand", label: "手のひら", icon: "✋" },
  { id: "select", label: "選択 / テキスト編集 (ダブルクリック)", icon: "↖" },
  { id: "textbox", label: "テキスト追加", icon: "T" },
  { id: "highlight", label: "蛍光ペン", icon: "🖊" },
  { id: "underline", label: "下線", icon: "U̲" },
  { id: "strikethrough", label: "取り消し線", icon: "S̶" },
  { id: "signature", label: "署名", icon: "✍" },
  { id: "stamp", label: "スタンプ", icon: "🔖" },
  { id: "stickynote", label: "付箋", icon: "📌" },
  { id: "callout", label: "吹き出し", icon: "💬" },
];

const SHAPE_TOOLS: { id: AnnotationTool; label: string; icon: string }[] = [
  { id: "shape-rect",    label: "矩形",  icon: "□" },
  { id: "shape-ellipse", label: "楕円",  icon: "○" },
  { id: "shape-line",    label: "直線",  icon: "╱" },
  { id: "shape-arrow",   label: "矢印",  icon: "→" },
  { id: "shape-polygon", label: "多角形 (右クリックで確定)", icon: "⬠" },
  { id: "pencil",        label: "フリーハンド", icon: "✏" },
];

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

export function Toolbar() {
  const { pdfDoc, zoom, fitMode, currentPage, numPages, setZoom, setFitMode, setCurrentPage } = usePdfStore();
  const { activeTool, setActiveTool, undo, redo, undoStack, redoStack } = useAnnotationStore();
  const { setSignatureDialogOpen, setStampDialogOpen, setSettingsOpen } = useUiStore();
  const { loadFromBytes } = usePdfjs();
  const { save } = useSavePdf();

  const openFile = useCallback(async () => {
    try {
      const path = await invoke<string | null>("open_file_dialog");
      if (!path) return;
      const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>("open_pdf", { path });
      const bytes = new Uint8Array(result.bytes);
      await loadFromBytes(bytes, result.file_path);
    } catch (err) {
      console.error("Open failed:", err);
    }
  }, [loadFromBytes]);

  const handleToolClick = useCallback((tool: AnnotationTool) => {
    if (tool === "signature") {
      setSignatureDialogOpen(true);
      return;
    }
    if (tool === "stamp") {
      setStampDialogOpen(true);
      return;
    }
    setActiveTool(tool);
  }, [setActiveTool, setSignatureDialogOpen, setStampDialogOpen]);

  const handleImageInsert = useCallback(async () => {
    try {
      const path = await invoke<string | null>("open_image_dialog");
      if (!path) return;
      const rawBytes = await invoke<number[]>("read_file_bytes", { path });
      const uint8 = new Uint8Array(rawBytes);
      const ext = path.split(".").pop()?.toLowerCase() ?? "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "gif" ? "image/gif"
        : ext === "webp" ? "image/webp"
        : "image/png";
      const binary = uint8.reduce((acc, b) => acc + String.fromCharCode(b), "");
      const dataUrl = `data:${mime};base64,${btoa(binary)}`;
      setPendingImageData(dataUrl);
      setActiveTool("image-add" as AnnotationTool);
    } catch (err) {
      console.error("Image insert failed:", err);
    }
  }, [setActiveTool]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "fit-width") {
      setFitMode("width");
    } else if (val === "fit-page") {
      setFitMode("page");
    } else {
      setZoom(parseFloat(val));
    }
  }, [setZoom, setFitMode]);

  const handlePageInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= numPages) setCurrentPage(val);
  }, [numPages, setCurrentPage]);

  return (
    <div style={{
      height: "var(--toolbar-height)",
      background: "var(--bg-toolbar)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      gap: 4,
      flexShrink: 0,
    }}>
      {/* File ops */}
      <button onClick={openFile} title="開く (Ctrl+O)" style={btnStyle}>📂</button>
      <button onClick={() => save()} disabled={!pdfDoc} title="保存 (Ctrl+S)" style={btnStyle}>💾</button>
      <div style={separatorStyle} />

      {/* Tools dropdown */}
      <ToolsMenu />
      <div style={separatorStyle} />

      {/* Undo/Redo */}
      <button onClick={undo} disabled={undoStack.length === 0} title="元に戻す (Ctrl+Z)" style={btnStyle}>↩</button>
      <button onClick={redo} disabled={redoStack.length === 0} title="やり直し (Ctrl+Y)" style={btnStyle}>↪</button>
      <div style={separatorStyle} />

      {/* Annotation tools */}
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleToolClick(tool.id)}
          title={tool.label}
          style={{
            ...btnStyle,
            background: activeTool === tool.id ? "var(--accent)" : "transparent",
            color: activeTool === tool.id ? "#fff" : "var(--text-primary)",
          }}
        >
          {tool.icon}
        </button>
      ))}
      <div style={separatorStyle} />

      {/* Shape tools */}
      {SHAPE_TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
          style={{
            ...btnStyle,
            fontWeight: 600,
            fontSize: 15,
            background: activeTool === tool.id ? "var(--accent)" : "transparent",
            color: activeTool === tool.id ? "#fff" : "var(--text-primary)",
          }}
        >
          {tool.icon}
        </button>
      ))}
      <button
        onClick={handleImageInsert}
        title="画像を挿入"
        disabled={!pdfDoc}
        style={{ ...btnStyle, background: activeTool === ("image-add" as AnnotationTool) ? "var(--accent)" : "transparent", color: activeTool === ("image-add" as AnnotationTool) ? "#fff" : "var(--text-primary)", opacity: pdfDoc ? 1 : 0.4 }}
      >
        🖼
      </button>
      <div style={separatorStyle} />

      {/* Zoom */}
      <select
        value={fitMode === "width" ? "fit-width" : fitMode === "page" ? "fit-page" : zoom}
        onChange={handleZoomChange}
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 3, padding: "2px 4px", fontSize: 12 }}
      >
        {ZOOM_PRESETS.map((z) => (
          <option key={z} value={z}>{Math.round(z * 100)}%</option>
        ))}
        <option value="fit-width">幅に合わせる</option>
        <option value="fit-page">ページに合わせる</option>
      </select>
      <div style={separatorStyle} />

      {/* Page nav */}
      {pdfDoc && (
        <>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} style={btnStyle}>‹</button>
          <input
            type="number" value={currentPage} min={1} max={numPages}
            onChange={handlePageInput}
            style={{ width: 40, textAlign: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 3, padding: "2px" }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>/ {numPages}</span>
          <button onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} style={btnStyle}>›</button>
        </>
      )}

      {/* Settings (right) */}
      <div style={{ marginLeft: "auto" }}>
        <button onClick={() => setSettingsOpen(true)} title="設定" style={btnStyle}>⚙</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
  fontSize: 15,
  color: "var(--text-primary)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "var(--border)",
  margin: "0 4px",
  flexShrink: 0,
};
