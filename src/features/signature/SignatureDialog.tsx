import React, { useRef, useState, useCallback } from "react";
import { useAnnotationStore } from "../../store/annotationStore";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog } from "../../components/Dialog";

export function SignatureDialog() {
  const isOpen = useUiStore(s => s.openDialog === "signature");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { addAnnotation } = useAnnotationStore();
  const { currentPage } = usePdfStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasStrokes(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    drawing.current = false;
  }, []);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    addAnnotation({
      type: "signature",
      pageIndex: currentPage - 1,
      pdfRect: { x: 100, y: 100, width: 200, height: 80 },
      dataUrl,
    });
    setDialogOpen(null);
    clearCanvas();
  }, [currentPage, addAnnotation, setDialogOpen, clearCanvas]);

  return (
    <Dialog isOpen={isOpen} onClose={() => setDialogOpen(null)} title="署名を描く" width={480}>
      <div style={{ padding: 24 }}>
        <canvas
          ref={canvasRef}
          width={432} height={200}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            background: "#fff", border: "1px solid var(--border)",
            borderRadius: 4, cursor: "crosshair", touchAction: "none", display: "block",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={clearCanvas} style={{ padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 4 }}>
            クリア
          </button>
          <button onClick={() => setDialogOpen(null)} style={{ padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 4 }}>
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasStrokes}
            style={{
              padding: "6px 16px", background: "var(--accent)", color: "#fff",
              borderRadius: 4, opacity: hasStrokes ? 1 : 0.5,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </Dialog>
  );
}
