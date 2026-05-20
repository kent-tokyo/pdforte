import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { AnnotationLayer } from "../annotations/AnnotationLayer";
import { TextLayer } from "./TextLayer";
import { useTextSelection } from "./useTextSelection";
import { useTextEdit } from "./useTextEdit";
import { useAnnotationStore } from "../../store/annotationStore";

interface Props {
  page: PDFPageProxy;
  pageIndex: number;
  zoom: number;
  isVisible: boolean;
}

export function PdfPage({ page, pageIndex, zoom, isVisible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);
  const prevZoomRef = useRef(zoom);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const activeTool = useAnnotationStore(s => s.activeTool);
  const selectedId = useAnnotationStore(s => s.selectedId);
  const setSelectedId = useAnnotationStore(s => s.setSelectedId);

  // Text layer is enabled when in text-selection modes (also handles double-click-to-edit in select mode)
  const textLayerEnabled =
    activeTool === "select" ||
    activeTool === "highlight" ||
    activeTool === "underline" ||
    activeTool === "strikethrough";

  const { handleSelectionEnd } = useTextSelection(
    pageIndex,
    viewport!,
    containerRef as React.RefObject<HTMLElement>
  );

  const { handleEditClick } = useTextEdit(
    pageIndex,
    viewport!,
    containerRef as React.RefObject<HTMLElement>
  );

  // Single click on non-annotation area → deselect / confirm current annotation
  const handlePageClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".annotation-item")) {
        if (selectedId) setSelectedId(null);
      }
    },
    [selectedId, setSelectedId]
  );

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const dpr = window.devicePixelRatio || 1;
    const vp = page.getViewport({ scale: zoom });
    setViewport(vp);
    setDimensions({ width: vp.width, height: vp.height });

    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = `${vp.width}px`;
    canvas.style.height = `${vp.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const renderContext = {
      canvasContext: ctx,
      viewport: vp,
    };

    try {
      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "RenderingCancelledException") {
        console.error("Page render error:", err);
      }
    }
  }, [page, zoom, isVisible]);

  useEffect(() => {
    const isZoomChange = prevZoomRef.current !== zoom;
    prevZoomRef.current = zoom;

    if (!isZoomChange) {
      render();
      return () => { renderTaskRef.current?.cancel(); };
    }

    // Debounce zoom changes: rapid wheel/pinch events collapse into one render.
    const timer = setTimeout(render, 80);
    return () => {
      clearTimeout(timer);
      renderTaskRef.current?.cancel();
    };
  }, [render, zoom]);

  return (
    <div
      ref={containerRef}
      className="pdf-page"
      onMouseUp={viewport ? handleSelectionEnd : undefined}
      onClick={handlePageClick}
      onDoubleClick={viewport ? handleEditClick : undefined}
      style={{
        position: "relative",
        display: "inline-block",
        marginBottom: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        background: "#fff",
        width: dimensions.width,
        height: dimensions.height,
        // cursor changes based on tool
        cursor: textLayerEnabled ? "text" : "default",
      }}
    >
      <canvas ref={canvasRef} />
      {viewport && (
        <TextLayer page={page} viewport={viewport} enabled={textLayerEnabled} />
      )}
      {viewport && (
        <AnnotationLayer pageIndex={pageIndex} viewport={viewport} pdfPage={page} />
      )}
    </div>
  );
}
