import { useEffect, useRef, useState, useCallback } from "react";
import { PdfPage } from "./PdfPage";
import { usePdfStore } from "../../store/pdfStore";
import { useUiStore } from "../../store/uiStore";
import { HomeScreen } from "./HomeScreen";
import { FindBar } from "./FindBar";

export function PdfViewer() {
  const { pdfDoc, zoom, setZoom, fitMode, setCurrentPage } = usePdfStore();
  const { readingMode, setReadingMode, setContextMenu } = useUiStore();
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
  }, [fitMode, basePageSize]);

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
        if (rect.top < (containerRect.top + containerRect.bottom) / 2) {
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

  const { currentPage, numPages } = usePdfStore();
  useEffect(() => {
    if (!pdfDoc) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        setCurrentPage(Math.min(numPages, currentPage + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentPage(Math.max(1, currentPage - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(1);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPage(numPages);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfDoc, currentPage, numPages, setCurrentPage]);

  const handleViewerContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection) return;
    e.preventDefault();
    setContextMenu({
      items: [{ label: "コピー", action: () => navigator.clipboard.writeText(selection) }],
      x: e.clientX,
      y: e.clientY,
    });
  }, [setContextMenu]);

  if (!pdfDoc) {
    return <HomeScreen />;
  }

  return (
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      <FindBar />
      <div
        ref={containerRef}
        onContextMenu={handleViewerContextMenu}
        style={{
          height: "100%",
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
    </div>
  );
}
