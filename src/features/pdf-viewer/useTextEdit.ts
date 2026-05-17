import { useCallback } from "react";
import type { PageViewport } from "pdfjs-dist";
import { useAnnotationStore } from "../../store/annotationStore";
import { screenRectToPdf } from "../annotations/annotationUtils";

const CJK_RE = /[　-鿿豈-﫿가-힯一-鿿]/;
const SERIF_NAMES = /mincho|ming|song|batang|明朝|宋|明|times|georgia|palatino/i;

function resolveFontFamily(text: string, computedFamily: string): string {
  if (!CJK_RE.test(text)) {
    // Latin text: use computed family if it looks like a real CSS font name
    // (PDF.js internal names are short alphanumeric like "g_d0_f1")
    if (/^g_[a-z0-9_]+$/i.test(computedFamily.split(",")[0].trim())) {
      return "sans-serif";
    }
    return computedFamily;
  }
  // CJK: detect Mincho (明朝) vs Gothic (ゴシック) from original font name
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

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== "select") return;

      const target = e.target as HTMLElement;
      if (target.tagName !== "SPAN" || !target.closest(".pdf-text-layer")) return;

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const spanRect = target.getBoundingClientRect();

      // Use CSS font-size (not bounding rect height which includes line-height gap)
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

      // Font size in PDF points (divide screen pixels by viewport scale)
      const fontSize = Math.max(Math.round(lineHeight / viewport.scale), 6);

      // Copy font properties from the original span
      const fontWeight = parseFloat(style.fontWeight);
      const bold = fontWeight >= 600;
      const italic = style.fontStyle === "italic";
      const fontColor = style.color || "#000000";

      // Resolve font family: PDF.js uses internal names (g_d0_f1 etc.) that
      // don't work as CSS font-family outside the text layer. Map CJK text to
      // system Japanese fonts; for Latin text keep the computed value.
      const fontFamily = resolveFontFamily(text, style.fontFamily);

      // Hide original span text so it doesn't bleed through the white overlay
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
    },
    [activeTool, pageIndex, viewport, containerRef, addAnnotation]
  );

  return { handleEditClick };
}
