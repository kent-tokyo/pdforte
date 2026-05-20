import * as pdfjsLib from "pdfjs-dist";
import "./features/pdf-viewer/pdfWorker";
import { usePdfStore } from "./store/pdfStore";
import { useUiStore } from "./store/uiStore";
import { useAnnotationStore } from "./store/annotationStore";

async function loadPdfFromUrl(url: string, name: string): Promise<void> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  usePdfStore.getState().setIsLoading(true);
  try {
    const task = pdfjsLib.getDocument({ data: bytes.slice() });
    const doc = await task.promise;
    useAnnotationStore.getState().clearAnnotations();
    usePdfStore.getState().setPdfDoc(doc, name, bytes);
  } finally {
    usePdfStore.getState().setIsLoading(false);
  }
}

declare global {
  interface Window {
    __TEST__: {
      usePdfStore: typeof usePdfStore;
      useUiStore: typeof useUiStore;
      useAnnotationStore: typeof useAnnotationStore;
      loadPdfFromUrl: typeof loadPdfFromUrl;
    };
  }
}

window.__TEST__ = { usePdfStore, useUiStore, useAnnotationStore, loadPdfFromUrl };
