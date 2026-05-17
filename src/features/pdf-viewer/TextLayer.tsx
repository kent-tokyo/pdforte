import { useEffect, useRef } from "react";
import { TextLayer as PdfjsTextLayer } from "pdfjs-dist";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";

interface Props {
  page: PDFPageProxy;
  viewport: PageViewport;
  enabled: boolean;
}

export function TextLayer({ page, viewport, enabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<PdfjsTextLayer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    if (!enabled) return;

    let cancelled = false;

    const renderLayer = async () => {
      try {
        const textContent = await page.getTextContent();
        if (cancelled) return;

        const layer = new PdfjsTextLayer({
          textContentSource: textContent,
          container,
          viewport,
        });
        layerRef.current = layer;
        await layer.render();
      } catch {
        // ignore cancelled renders
      }
    };

    renderLayer();

    return () => {
      cancelled = true;
      layerRef.current?.cancel();
      layerRef.current = null;
    };
  }, [page, viewport, enabled]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        // auto: text selectable or edit-clickable; none: pass through to canvas
        pointerEvents: enabled ? "auto" : "none",
        // Required for PDF.js text layer positioning
        lineHeight: 1,
        overflow: "hidden",
      }}
      className="pdf-text-layer"
    />
  );
}
