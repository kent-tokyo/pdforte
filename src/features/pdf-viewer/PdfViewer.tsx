import { useEffect, useRef, useState, useCallback } from "react";
import { PdfPage } from "./PdfPage";
import { usePdfStore } from "../../store/pdfStore";
import { useUiStore } from "../../store/uiStore";
import { HomeScreen } from "./HomeScreen";

export function PdfViewer() {
  const { pdfDoc, zoom, setZoom, fitMode, setCurrentPage } = usePdfStore();
  const { readingMode, setReadingMode } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<import("pdfjs-dist").PDFPageProxy[]>([]);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([0, 1]));
  const [basePageSize, setBasePageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!pdfDoc) { setPages([]); return; }
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(
        Array.from({ length: pdfDoc.numPages }, (_, i) => pdfDoc.getPage(i + 1))
      );
      if (!cancelled) setPages(loaded);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    pdfDoc.getPage(1).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: 1.0 });
      setBasePageSize({ width: vp.width, height: vp.height });
    });
    return () => { cancelled = true; };
  }, [pdfDoc]);

  useEffect(() => {
    if (fitMode === "custom" || !basePageSize || !containerRef.current) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    if (fitMode === "width") setZoom(Math.max(0.1, cw / basePageSize.width));
    if (fitMode === "page") setZoom(Math.max(0.1, Math.min(cw / basePageSize.width, ch / basePageSize.height)));
  }, [fitMode, basePageSize]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitMode === "custom" || !basePageSize || !containerRef.current) return;
      const cw = containerRef.current.clientWidth - 40;
      const ch = containerRef.current.clientHeight - 40;
      if (fitMode === "width") setZoom(Math.max(0.1, cw / basePageSize.width));
      if (fitMode === "page") setZoom(Math.max(0.1, Math.min(cw / basePageSize.width, ch / basePageSize.height)));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitMode, basePageSize, containerRef.current]);

  const updateVisible = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const pageEls = container.querySelectorAll<HTMLElement>(".pdf-page-wrapper");
    const visible = new Set<number>();
    pageEls.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.bottom > containerRect.top - 200 && rect.top < containerRect.bottom + 200) {
        visible.add(i);
        if (rect.top < containerRect.bottom / 2) {
          setCurrentPage(i + 1);
        }
      }
    });
    setVisiblePages(visible);
  }, [setCurrentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", updateVisible, { passive: true });
    updateVisible();
    return () => container.removeEventListener("scroll", updateVisible);
  }, [updateVisible, pages]);

  if (!pdfDoc) {
    return <HomeScreen />;
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "auto",
        background: "var(--bg-viewer)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {readingMode && (
        <button
          onClick={() => setReadingMode(false)}
          style={{
            position: "fixed", top: 12, right: 16, zIndex: 100,
            background: "rgba(0,0,0,0.5)", color: "#fff",
            border: "none", borderRadius: 4, padding: "4px 10px",
            fontSize: 12, cursor: "pointer",
          }}
        >
          ✕ 閲覧モード終了
        </button>
      )}
      {pages.map((page, i) => (
        <div key={i} className="pdf-page-wrapper">
          <PdfPage
            page={page}
            pageIndex={i}
            zoom={zoom}
            isVisible={visiblePages.has(i)}
          />
        </div>
      ))}
    </div>
  );
}
