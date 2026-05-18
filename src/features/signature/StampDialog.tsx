import React, { useRef, useState, useCallback } from "react";
import { useAnnotationStore } from "../../store/annotationStore";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog } from "../../components/Dialog";

export function StampDialog() {
  const isOpen = useUiStore(s => s.openDialog === "stamp");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { addAnnotation } = useAnnotationStore();
  const { currentPage } = usePdfStore();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const close = useCallback(() => {
    setDialogOpen(null);
    setPreview(null);
  }, [setDialogOpen]);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    addAnnotation({
      type: "stamp",
      pageIndex: currentPage - 1,
      pdfRect: { x: 100, y: 100, width: 150, height: 150 },
      dataUrl: preview,
      opacity: 1,
    });
    setDialogOpen(null);
    setPreview(null);
  }, [preview, currentPage, addAnnotation, setDialogOpen]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="スタンプ画像を選択" width={400}>
      <div style={{ padding: 24 }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ marginBottom: 16 }} />
        {preview && (
          <img src={preview} style={{ width: "100%", maxHeight: 200, objectFit: "contain", marginBottom: 16, border: "1px solid var(--border)" }} />
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={close} style={{ padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 4 }}>
            キャンセル
          </button>
          <button onClick={handleConfirm} disabled={!preview} style={{ padding: "6px 16px", background: "var(--accent)", color: "#fff", borderRadius: 4, opacity: preview ? 1 : 0.5 }}>
            OK
          </button>
        </div>
      </div>
    </Dialog>
  );
}
