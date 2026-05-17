import type { PageViewport } from "pdfjs-dist";

export function pdfRectToScreen(
  pdfRect: { x: number; y: number; width: number; height: number },
  viewport: PageViewport
): { left: number; top: number; width: number; height: number } {
  const [x1, y1] = viewport.convertToViewportPoint(pdfRect.x, pdfRect.y + pdfRect.height);
  const [x2, y2] = viewport.convertToViewportPoint(pdfRect.x + pdfRect.width, pdfRect.y);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function screenRectToPdf(
  screenRect: { left: number; top: number; width: number; height: number },
  viewport: PageViewport
): { x: number; y: number; width: number; height: number } {
  const [x1, y1] = viewport.convertToPdfPoint(screenRect.left, screenRect.top);
  const [x2, y2] = viewport.convertToPdfPoint(
    screenRect.left + screenRect.width,
    screenRect.top + screenRect.height
  );
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
