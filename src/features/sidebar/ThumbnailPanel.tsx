import { useEffect, useRef, useState, memo } from "react";
import { usePdfStore } from "../../store/pdfStore";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface ItemProps {
  pdfDoc: PDFDocumentProxy;
  pageIndex: number;
  isActive: boolean;
  onClick: () => void;
}

// Renders lazily: only fetches + draws the page canvas when scrolled into view.
const ThumbnailItem = memo(function ThumbnailItem({ pdfDoc, pageIndex, isActive, onClick }: ItemProps) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // src is already loaded for this doc — nothing to do.
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
        cursor: "pointer",
        border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: 4,
        overflow: "hidden",
        background: isActive ? "var(--accent)1a" : "transparent",
        boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
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
  const currentPage = usePdfStore(s => s.currentPage);
  const setCurrentPage = usePdfStore(s => s.setCurrentPage);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset ref array length when doc changes.
  const numPages = pdfDoc?.numPages ?? 0;
  if (itemRefs.current.length !== numPages) {
    itemRefs.current = new Array(numPages).fill(null);
  }

  // Track doc identity so ThumbnailItem keys change when a new file is opened,
  // forcing React to unmount old items and reset their src state.
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

  if (!pdfDoc) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>PDFを開いてください</div>;
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: 8 }}>
      {Array.from({ length: pdfDoc.numPages }, (_, i) => (
        <div key={`${docId}-${i}`} ref={(el) => { itemRefs.current[i] = el; }}>
          <ThumbnailItem
            pdfDoc={pdfDoc}
            pageIndex={i}
            isActive={currentPage === i + 1}
            onClick={() => setCurrentPage(i + 1)}
          />
        </div>
      ))}
    </div>
  );
}
