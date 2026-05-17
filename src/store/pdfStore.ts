import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PdfState {
  pdfDoc: PDFDocumentProxy | null;
  filePath: string | null;
  originalBytes: Uint8Array | null;
  numPages: number;
  currentPage: number;
  zoom: number;
  fitMode: "custom" | "width" | "page";
  isLoading: boolean;
  isDirty: boolean;
  setPdfDoc: (doc: PDFDocumentProxy | null, filePath: string | null, bytes?: Uint8Array) => void;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setFitMode: (mode: "custom" | "width" | "page") => void;
  setIsLoading: (loading: boolean) => void;
  setIsDirty: (dirty: boolean) => void;
  close: () => void;
}

export const usePdfStore = create<PdfState>((set, get) => ({
  pdfDoc: null,
  filePath: null,
  originalBytes: null,
  numPages: 0,
  currentPage: 1,
  zoom: 1.0,
  fitMode: "custom",
  isLoading: false,
  isDirty: false,
  setPdfDoc: (doc, filePath, bytes) => {
    get().pdfDoc?.destroy();
    set({ pdfDoc: doc, filePath, originalBytes: bytes ?? null, numPages: doc?.numPages ?? 0, currentPage: 1, isDirty: false });
  },
  setCurrentPage: (currentPage) => set({ currentPage }),
  setZoom: (zoom) => set({ zoom, fitMode: "custom" }),
  setFitMode: (mode) => set({ fitMode: mode }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsDirty: (isDirty) => set({ isDirty }),
  close: () => {
    get().pdfDoc?.destroy();
    set({ pdfDoc: null, filePath: null, originalBytes: null, numPages: 0, currentPage: 1, isDirty: false });
  },
}));
