import type { PageViewport } from "pdfjs-dist";

export function pdfPointToScreen(
  pdfX: number,
  pdfY: number,
  viewport: PageViewport,
  canvasRect: DOMRect
): { left: number; top: number } {
  const [screenX, screenY] = viewport.convertToViewportPoint(pdfX, pdfY);
  return {
    left: screenX - canvasRect.left,
    top: screenY - canvasRect.top,
  };
}

export function screenToPdfPoint(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  viewport: PageViewport
): { pdfX: number; pdfY: number } {
  const screenX = clientX - canvasRect.left;
  const screenY = clientY - canvasRect.top;
  const [pdfX, pdfY] = viewport.convertToPdfPoint(screenX, screenY);
  return { pdfX, pdfY };
}

// NOTE: pdfRectToScreen was removed — use annotationUtils.pdfRectToScreen instead,
// which correctly handles the PDF bottom-left / screen top-left coordinate inversion.
