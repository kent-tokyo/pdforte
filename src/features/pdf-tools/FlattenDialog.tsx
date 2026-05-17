import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { embedAnnotationsAndSave } from "../annotations/savePipeline";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function FlattenDialog() {
  const { flattenDialogOpen, setFlattenDialogOpen } = useUiStore();
  const { filePath, originalBytes } = usePdfStore();
  const { annotations, clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => setFlattenDialogOpen(false), [setFlattenDialogOpen]);

  const handleFlatten = useCallback(async (saveAs: boolean) => {
    if (!originalBytes || !filePath) return;
    setBusy(true);
    try {
      const bakedBytes = await embedAnnotationsAndSave(originalBytes, annotations);

      let targetPath = filePath;
      if (saveAs) {
        const stem = filePath.replace(/\.pdf$/i, "").split(/[/\\]/).pop() ?? "document";
        const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${stem}_flat.pdf` });
        if (!outPath) { setBusy(false); return; }
        targetPath = outPath;
      }

      await invoke("save_bytes", { path: targetPath, bytes: Array.from(bakedBytes) });

      // Delete sidecar of the original (if in-place)
      if (!saveAs) {
        try { await invoke("delete_sidecar", { pdfPath: filePath }); } catch { /* ok */ }
      }

      // Reload the flattened PDF as the new original
      await loadFromBytes(bakedBytes, targetPath);
      clearAnnotations();
      close();
    } catch (err) {
      alert(`フラット化エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, annotations, loadFromBytes, clearAnnotations, close]);

  return (
    <Dialog isOpen={flattenDialogOpen} onClose={close} title="📋 PDFをフラット化" width={420}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          すべての注釈を PDF に永久に焼き込みます。<br />
          <strong style={{ color: "#e34850" }}>この操作は元に戻せません。</strong><br />
          焼き込み後は注釈の編集ができなくなります。
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={() => handleFlatten(true)}
            disabled={busy}
            style={{ ...cancelBtnStyle, opacity: busy ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "別名で保存..."}
          </button>
          <button
            onClick={() => handleFlatten(false)}
            disabled={busy || !filePath}
            style={{ ...actionBtnStyle, opacity: busy || !filePath ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "上書き保存"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
