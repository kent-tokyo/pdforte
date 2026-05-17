import { useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationStore } from "../../store/annotationStore";
import type { AnnotationTool } from "../annotations/annotationTypes";

export function useTextSelection(
  pageIndex: number,
  viewport: PageViewport,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const { activeTool, addAnnotation } = useAnnotationStore();

  const handleSelectionEnd = useCallback(() => {
    if (
      activeTool !== "highlight" &&
      activeTool !== "underline" &&
      activeTool !== "strikethrough"
    ) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Collect all client rects from the selection
    const range = selection.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    if (clientRects.length === 0) return;

    // Convert screen rects to PDF coordinate system
    const pdfRects = clientRects
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => {
        // Screen coords relative to the page container
        const screenLeft = r.left - containerRect.left;
        const screenTop = r.top - containerRect.top;
        const screenRight = r.right - containerRect.left;
        const screenBottom = r.bottom - containerRect.top;

        // Convert to PDF user-space (bottom-left origin)
        const [x1, y1] = viewport.convertToPdfPoint(screenLeft, screenTop);
        const [x2, y2] = viewport.convertToPdfPoint(screenRight, screenBottom);

        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        };
      });

    if (pdfRects.length === 0) return;

    // Overall bounding box for pdfRect (required by AnnotationBase)
    const xs = pdfRects.map((r) => r.x);
    const ys = pdfRects.map((r) => r.y);
    const x2s = pdfRects.map((r) => r.x + r.width);
    const y2s = pdfRects.map((r) => r.y + r.height);
    const pdfRect = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...x2s) - Math.min(...xs),
      height: Math.max(...y2s) - Math.min(...ys),
    };

    const colorMap: Record<AnnotationTool, string> = {
      highlight: "#FFFF00",
      underline: "#0000FF",
      strikethrough: "#FF0000",
      select: "#FFFF00",
      hand: "#FFFF00",
      textbox: "#FFFF00",
      signature: "#FFFF00",
      stamp: "#FFFF00",
      stickynote: "#FFFF00",
      callout: "#FFFF00",
      "shape-rect": "#FFFF00",
      "shape-ellipse": "#FFFF00",
      "shape-line": "#FFFF00",
      "shape-arrow": "#FFFF00",
      "shape-polygon": "#FFFF00",
      "pencil": "#FFFF00",
      "image-add": "#FFFF00",
    };

    addAnnotation({
      type: activeTool as "highlight" | "underline" | "strikethrough",
      pageIndex,
      pdfRect,
      color: colorMap[activeTool],
      rects: pdfRects,
    });

    selection.removeAllRanges();
  }, [activeTool, pageIndex, viewport, containerRef, addAnnotation]);

  return { handleSelectionEnd };
}
