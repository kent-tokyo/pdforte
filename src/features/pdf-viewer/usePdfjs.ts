import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "./pdfWorker";
import { usePdfStore } from "../../store/pdfStore";
import { useUiStore } from "../../store/uiStore";
import { useAnnotationStore } from "../../store/annotationStore";

// Module-level ref so PasswordDialog can resolve it
let _pendingPasswordUpdate: ((password: string) => void) | null = null;

export function submitPassword(password: string) {
  if (_pendingPasswordUpdate) {
    _pendingPasswordUpdate(password);
    _pendingPasswordUpdate = null;
  }
}

export function usePdfjs() {
  const { setPdfDoc, setIsLoading } = usePdfStore();
  const { setPasswordDialog } = useUiStore();
  const taskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null);

  async function loadFromBytes(bytes: Uint8Array, filePath: string) {
    if (taskRef.current) {
      taskRef.current.destroy();
    }
    // Clear any stale password callback from a previous load before starting a new one.
    _pendingPasswordUpdate = null;
    setIsLoading(true);
    try {
      const task = pdfjsLib.getDocument({
        data: bytes.slice(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(true && { onPassword: (updatePassword: (password: string) => void, reason: number) => {
          _pendingPasswordUpdate = updatePassword;
          setPasswordDialog(true, reason === 2);
        }}) as Record<string, unknown>,
      } as Parameters<typeof pdfjsLib.getDocument>[0]);
      taskRef.current = task;
      const doc = await task.promise;
      setPasswordDialog(false);
      useAnnotationStore.getState().clearAnnotations();
      setPdfDoc(doc, filePath, bytes);
    } catch (err) {
      console.error("PDF load failed:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      taskRef.current?.destroy();
    };
  }, []);

  return { loadFromBytes };
}
