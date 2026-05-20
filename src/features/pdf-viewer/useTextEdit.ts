import { useCallback, useEffect } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationStore } from "../../store/annotationStore";
import { screenRectToPdf } from "../annotations/annotationUtils";

const CJK_RE = /[　-鿿豈-﫿가-힯一-鿿]/;
const SERIF_NAMES = /mincho|ming|song|batang|明朝|宋|明|times|georgia|palatino/i;

// Module-level map: annotationId → hidden span element (for undo restoration)
const hiddenSpanMap = new Map<string, HTMLElement>();

function resolveFontFamily(text: string, computedFamily: string): string {
  if (!CJK_RE.test(text)) {
    if (/^g_[a-z0-9_]+$/i.test(computedFamily.split(",")[0].trim())) {
      return "sans-serif";
    }
    return computedFamily;
  }
  const isSerif = SERIF_NAMES.test(computedFamily);
  return isSerif
    ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif'
    : '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';
}

export function useTextEdit(
  pageIndex: number,
  viewport: PageViewport,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const { activeTool, addAnnotation } = useAnnotationStore();
  const annotations = useAnnotationStore(s => s.annotations);

  // Restore spans for annotations that were removed or undone
  useEffect(() => {
    if (hiddenSpanMap.size === 0) return;
    for (const [id, span] of hiddenSpanMap) {
      let found = false;
      for (const pageAnns of annotations.values()) {
        if (pageAnns.some(a => a.id === id)) { found = true; break; }
      }
      if (!found) {
        span.style.color = "";
        hiddenSpanMap.delete(id);
      }
    }
  }, [annotations]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== "select") return;

      const target = e.target as HTMLElement;
      if (target.tagName !== "SPAN" || !target.closest(".pdf-text-layer")) return;

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const spanRect = target.getBoundingClientRect();

      const style = window.getComputedStyle(target);
      const cssFontSize = parseFloat(style.fontSize);
      const lineHeight = isNaN(cssFontSize) || cssFontSize === 0 ? spanRect.height : cssFontSize;

      const screenRect = {
        left: spanRect.left - containerRect.left,
        top: spanRect.top - containerRect.top,
        width: spanRect.width,
        height: lineHeight,
      };

      const pdfRect = screenRectToPdf(screenRect, viewport);
      const text = target.textContent ?? "";

      const fontSize = Math.max(Math.round(lineHeight / viewport.scale), 6);

      const fontWeight = parseFloat(style.fontWeight);
      const bold = fontWeight >= 600;
      const italic = style.fontStyle === "italic";
      const fontColor = style.color || "#000000";

      const fontFamily = resolveFontFamily(text, style.fontFamily);

      target.style.color = "transparent";

      addAnnotation({
        type: "textbox",
        pageIndex,
        pdfRect,
        content: text,
        fontSize,
        fontFamily,
        fontColor,
        bgColor: "#ffffff",
        bold,
        italic,
        lang: "ja",
      });

      // Track this span so we can restore it if the annotation is undone
      const id = useAnnotationStore.getState().selectedId;
      if (id) hiddenSpanMap.set(id, target);
    },
    [activeTool, pageIndex, viewport, containerRef, addAnnotation]
  );

  return { handleEditClick };
}
