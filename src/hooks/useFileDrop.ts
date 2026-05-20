import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { usePdfjs } from "../features/pdf-viewer/usePdfjs";

export function useFileDrop() {
  const { loadFromBytes } = usePdfjs();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const webview = getCurrentWebviewWindow();
      const fn = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        const paths = (event.payload as { type: string; paths: string[] }).paths;
        const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
        if (pdfPaths.length === 0) return;
        try {
          const path = pdfPaths[0];
          const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>(
            "open_pdf", { path }
          );
          await loadFromBytes(new Uint8Array(result.bytes), result.file_path);
        } catch (err) {
          console.error("Drop open failed:", err);
        }
      });
      if (cancelled) fn();
      else unlisten = fn;
    };

    setup();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [loadFromBytes]);
}
