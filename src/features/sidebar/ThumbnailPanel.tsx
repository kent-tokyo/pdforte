import { useEffect, useRef, useState, memo, useCallback } from "react";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { reorderPages } from "../pdf-tools/pdfOperations";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface ItemProps {
  pdfDoc: PDFDocumentProxy;
  pageIndex: number;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onClick: () => void;
}

const ThumbnailItem = memo(function ThumbnailItem({ pdfDoc, pageIndex, isActive, isDragging, isDragOver, onClick }: ItemProps) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (src) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        try {
          const page = await pdfDoc.getPage(pageIndex + 1);
          if (cancelled) return;
          const vp = page.getViewport({ scale: 0.2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (!ctx || cancelled) return;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) return;
          setSrc(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          // render cancelled or page gone — ignore
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdfDoc, pageIndex, src]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        marginBottom: 8,
        cursor: "grab",
        border: isActive ? "2px solid var(--accent)" : isDragOver ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: 4,
        overflow: "hidden",
        background: isActive ? "var(--accent)1a" : "transparent",
        boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
        opacity: isDragging ? 0.4 : 1,
        borderTop: isDragOver ? "3px solid var(--accent)" : undefined,
      }}
    >
      {src ? (
        <img src={src} style={{ width: "100%", display: "block" }} alt={`Page ${pageIndex + 1}`} />
      ) : (
        <div style={{
          width: "100%",
          aspectRatio: "0.707",
          background: "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 10,
        }}>
          {pageIndex + 1}
        </div>
      )}
      <div style={{
        textAlign: "center", fontSize: 10, padding: "2px 0",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        fontWeight: isActive ? 700 : 400,
      }}>
        {pageIndex + 1}
      </div>
    </div>
  );
});

export function ThumbnailPanel() {
  const pdfDoc = usePdfStore(s => s.pdfDoc);
  const originalBytes = usePdfStore(s => s.originalBytes);
  const filePath = usePdfStore(s => s.filePath);
  const currentPage = usePdfStore(s => s.currentPage);
  const setCurrentPage = usePdfStore(s => s.setCurrentPage);
  const clearAnnotations = useAnnotationStore(s => s.clearAnnotations);
  const { loadFromBytes } = usePdfjs();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const numPages = pdfDoc?.numPages ?? 0;
  if (itemRefs.current.length !== numPages) {
    itemRefs.current = new Array(numPages).fill(null);
  }

  const docIdRef = useRef(0);
  const prevDocRef = useRef(pdfDoc);
  if (prevDocRef.current !== pdfDoc) {
    prevDocRef.current = pdfDoc;
    docIdRef.current++;
  }
  const docId = docIdRef.current;

  useEffect(() => {
    itemRefs.current[currentPage - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  const handleDrop = useCallback(async (targetIndex: number) => {
    if (dragSrc === null || dragSrc === targetIndex || !originalBytes || !filePath) return;
    const order = Array.from({ length: numPages }, (_, i) => i);
    order.splice(targetIndex, 0, order.splice(dragSrc, 1)[0]);
    setDragSrc(null);
    setDragOver(null);
    const newBytes = await reorderPages(originalBytes, order);
    clearAnnotations();
    await loadFromBytes(newBytes, filePath);
  }, [dragSrc, numPages, originalBytes, filePath, clearAnnotations, loadFromBytes]);

  if (!pdfDoc) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>PDFを開いてください</div>;
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: 8 }}>
      {Array.from({ length: pdfDoc.numPages }, (_, i) => (
        <div
          key={`${docId}-${i}`}
          ref={(el) => { itemRefs.current[i] = el; }}
          draggable
          onDragStart={() => setDragSrc(i)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
          onDragEnd={() => { setDragSrc(null); setDragOver(null); }}
          onDrop={() => handleDrop(i)}
        >
          <ThumbnailItem
            pdfDoc={pdfDoc}
            pageIndex={i}
            isActive={currentPage === i + 1}
            isDragging={dragSrc === i}
            isDragOver={dragOver === i && dragSrc !== i}
            onClick={() => setCurrentPage(i + 1)}
          />
        </div>
      ))}
    </div>
  );
}
