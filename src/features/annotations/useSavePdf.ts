import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { embedAnnotationsAndSave } from "./savePipeline";

export function useSavePdf() {
  const { filePath, originalBytes, setIsDirty } = usePdfStore();
  const { annotations } = useAnnotationStore();

  const save = useCallback(async (targetPath?: string): Promise<boolean> => {
    const path = targetPath ?? filePath;
    if (!path || !originalBytes) return false;
    try {
      const newBytes = await embedAnnotationsAndSave(originalBytes, annotations);
      await invoke("save_pdf", { path, bytes: Array.from(newBytes) });
      setIsDirty(false);
      return true;
    } catch (err) {
      console.error("Save failed:", err);
      return false;
    }
  }, [filePath, originalBytes, annotations, setIsDirty]);

  const saveAs = useCallback(async (): Promise<boolean> => {
    if (!originalBytes) return false;
    const defaultName = filePath
      ? (filePath.split("/").pop() ?? filePath.split("\\").pop() ?? "document.pdf")
      : "document.pdf";
    try {
      const newPath = await invoke<string | null>("save_file_dialog", { defaultName });
      if (!newPath) return false;
      return await save(newPath);
    } catch (err) {
      console.error("Save As failed:", err);
      return false;
    }
  }, [filePath, originalBytes, save]);

  return { save, saveAs };
}
