import { create } from "zustand";

export type SidebarTab = "explorer" | "thumbnails" | "bookmarks" | "search" | "annotations";

interface UiState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarWidth: number;
  explorerPath: string | null;
  settingsOpen: boolean;
  signatureDialogOpen: boolean;
  stampDialogOpen: boolean;
  splitDialogOpen: boolean;
  pageOrderDialogOpen: boolean;
  mergeDialogOpen: boolean;
  exportImagesDialogOpen: boolean;
  convertDialogOpen: boolean;
  ocrDialogOpen: boolean;
  rotateDialogOpen: boolean;
  protectDialogOpen: boolean;
  translateDialogOpen: boolean;
  printDialogOpen: boolean;
  scannerDialogOpen: boolean;
  sanitizeDialogOpen: boolean;
  metadataDialogOpen: boolean;
  signatureVerifyDialogOpen: boolean;
  createPdfDialogOpen: boolean;
  extractPagesDialogOpen: boolean;
  watermarkDialogOpen: boolean;
  pageNumbersDialogOpen: boolean;
  compressDialogOpen: boolean;
  flattenDialogOpen: boolean;
  unlockDialogOpen: boolean;
  passwordDialogOpen: boolean;
  passwordDialogIsRetry: boolean;
  aboutOpen: boolean;
  readingMode: boolean;

  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarWidth: (width: number) => void;
  setExplorerPath: (path: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setSignatureDialogOpen: (open: boolean) => void;
  setStampDialogOpen: (open: boolean) => void;
  setSplitDialogOpen: (open: boolean) => void;
  setPageOrderDialogOpen: (open: boolean) => void;
  setMergeDialogOpen: (open: boolean) => void;
  setExportImagesDialogOpen: (open: boolean) => void;
  setConvertDialogOpen: (open: boolean) => void;
  setOcrDialogOpen: (open: boolean) => void;
  setRotateDialogOpen: (open: boolean) => void;
  setProtectDialogOpen: (open: boolean) => void;
  setTranslateDialogOpen: (open: boolean) => void;
  setPrintDialogOpen: (open: boolean) => void;
  setScannerDialogOpen: (open: boolean) => void;
  setSanitizeDialogOpen: (open: boolean) => void;
  setMetadataDialogOpen: (open: boolean) => void;
  setSignatureVerifyDialogOpen: (open: boolean) => void;
  setCreatePdfDialogOpen: (open: boolean) => void;
  setExtractPagesDialogOpen: (open: boolean) => void;
  setWatermarkDialogOpen: (open: boolean) => void;
  setPageNumbersDialogOpen: (open: boolean) => void;
  setCompressDialogOpen: (open: boolean) => void;
  setFlattenDialogOpen: (open: boolean) => void;
  setUnlockDialogOpen: (open: boolean) => void;
  setPasswordDialog: (open: boolean, isRetry?: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setReadingMode: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarTab: "thumbnails",
  sidebarWidth: 240,
  explorerPath: null,
  settingsOpen: false,
  signatureDialogOpen: false,
  stampDialogOpen: false,
  splitDialogOpen: false,
  pageOrderDialogOpen: false,
  mergeDialogOpen: false,
  exportImagesDialogOpen: false,
  convertDialogOpen: false,
  ocrDialogOpen: false,
  rotateDialogOpen: false,
  protectDialogOpen: false,
  translateDialogOpen: false,
  printDialogOpen: false,
  scannerDialogOpen: false,
  sanitizeDialogOpen: false,
  metadataDialogOpen: false,
  signatureVerifyDialogOpen: false,
  createPdfDialogOpen: false,
  extractPagesDialogOpen: false,
  watermarkDialogOpen: false,
  pageNumbersDialogOpen: false,
  compressDialogOpen: false,
  flattenDialogOpen: false,
  unlockDialogOpen: false,
  passwordDialogOpen: false,
  passwordDialogIsRetry: false,
  aboutOpen: false,
  readingMode: false,

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setExplorerPath: (explorerPath) => set({ explorerPath }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSignatureDialogOpen: (signatureDialogOpen) => set({ signatureDialogOpen }),
  setStampDialogOpen: (stampDialogOpen) => set({ stampDialogOpen }),
  setSplitDialogOpen: (splitDialogOpen) => set({ splitDialogOpen }),
  setPageOrderDialogOpen: (pageOrderDialogOpen) => set({ pageOrderDialogOpen }),
  setMergeDialogOpen: (mergeDialogOpen) => set({ mergeDialogOpen }),
  setExportImagesDialogOpen: (exportImagesDialogOpen) => set({ exportImagesDialogOpen }),
  setConvertDialogOpen: (convertDialogOpen) => set({ convertDialogOpen }),
  setOcrDialogOpen: (ocrDialogOpen) => set({ ocrDialogOpen }),
  setRotateDialogOpen: (rotateDialogOpen) => set({ rotateDialogOpen }),
  setProtectDialogOpen: (protectDialogOpen) => set({ protectDialogOpen }),
  setTranslateDialogOpen: (translateDialogOpen) => set({ translateDialogOpen }),
  setPrintDialogOpen: (printDialogOpen) => set({ printDialogOpen }),
  setScannerDialogOpen: (scannerDialogOpen) => set({ scannerDialogOpen }),
  setSanitizeDialogOpen: (sanitizeDialogOpen) => set({ sanitizeDialogOpen }),
  setMetadataDialogOpen: (metadataDialogOpen) => set({ metadataDialogOpen }),
  setSignatureVerifyDialogOpen: (signatureVerifyDialogOpen) => set({ signatureVerifyDialogOpen }),
  setCreatePdfDialogOpen: (createPdfDialogOpen) => set({ createPdfDialogOpen }),
  setExtractPagesDialogOpen: (extractPagesDialogOpen) => set({ extractPagesDialogOpen }),
  setWatermarkDialogOpen: (open) => set({ watermarkDialogOpen: open }),
  setPageNumbersDialogOpen: (open) => set({ pageNumbersDialogOpen: open }),
  setCompressDialogOpen: (open) => set({ compressDialogOpen: open }),
  setFlattenDialogOpen: (open) => set({ flattenDialogOpen: open }),
  setUnlockDialogOpen: (open) => set({ unlockDialogOpen: open }),
  setPasswordDialog: (open, isRetry = false) => set({ passwordDialogOpen: open, passwordDialogIsRetry: isRetry }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setReadingMode: (v) => set({ readingMode: v }),
}));
