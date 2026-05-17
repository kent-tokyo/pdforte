import { useEffect, useRef, useState } from "react";
import { usePdfStore } from "../../store/pdfStore";

export function ThumbnailPanel() {
  const { pdfDoc, currentPage, setCurrentPage } = usePdfStore();
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!pdfDoc) { setThumbnails([]); return; }
    let cancelled = false;
    (async () => {
      const urls: string[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) return;
        const page = await pdfDoc.getPage(i);
        if (cancelled) return;
        const vp = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
        urls.push(canvas.toDataURL("image/jpeg", 0.7));
      }
      setThumbnails(urls);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc]);

  useEffect(() => {
    itemRefs.current[currentPage - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  if (!pdfDoc) return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>PDFを開いてください</div>;

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: 8 }}>
      {thumbnails.map((url, i) => (
        <div
          key={i}
          ref={(el) => { itemRefs.current[i] = el; }}
          onClick={() => setCurrentPage(i + 1)}
          style={{
            marginBottom: 8,
            cursor: "pointer",
            border: currentPage === i + 1 ? "2px solid var(--accent)" : "2px solid transparent",
            borderRadius: 4,
            overflow: "hidden",
            background: currentPage === i + 1 ? "var(--accent)1a" : "transparent",
            boxShadow: currentPage === i + 1 ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
          }}
        >
          <img src={url} style={{ width: "100%", display: "block" }} />
          <div style={{
            textAlign: "center", fontSize: 10, padding: "2px 0",
            color: currentPage === i + 1 ? "var(--accent)" : "var(--text-muted)",
            fontWeight: currentPage === i + 1 ? 700 : 400,
          }}>
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
