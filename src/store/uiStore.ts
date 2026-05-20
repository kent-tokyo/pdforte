import { create } from "zustand";

export type SidebarTab = "explorer" | "thumbnails" | "bookmarks" | "search" | "annotations";

export type DialogName =
  | "settings" | "signature" | "stamp" | "merge" | "split" | "rotate"
  | "pageOrder" | "exportImages" | "convert" | "ocr" | "protect"
  | "translate" | "print" | "scanner" | "sanitize" | "metadata"
  | "signatureVerify" | "createPdf" | "extractPages" | "watermark"
  | "pageNumbers" | "compress" | "flatten" | "unlock" | "about";

export interface ContextMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface UiState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarWidth: number;
  explorerPath: string | null;
  openDialog: DialogName | null;
  passwordDialogOpen: boolean;
  passwordDialogIsRetry: boolean;
  readingMode: boolean;
  findBarOpen: boolean;
  contextMenu: { items: ContextMenuItem[]; x: number; y: number } | null;
  commentBalloon: { annotationId: string; x: number; y: number } | null;

  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarWidth: (width: number) => void;
  setExplorerPath: (path: string | null) => void;
  setDialogOpen: (name: DialogName | null) => void;
  setPasswordDialog: (open: boolean, isRetry?: boolean) => void;
  setReadingMode: (v: boolean) => void;
  setFindBarOpen: (v: boolean) => void;
  setContextMenu: (menu: { items: ContextMenuItem[]; x: number; y: number } | null) => void;
  setCommentBalloon: (v: { annotationId: string; x: number; y: number } | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarTab: "thumbnails",
  sidebarWidth: 240,
  explorerPath: null,
  openDialog: null,
  passwordDialogOpen: false,
  passwordDialogIsRetry: false,
  readingMode: false,
  findBarOpen: false,
  contextMenu: null,
  commentBalloon: null,

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setExplorerPath: (explorerPath) => set({ explorerPath }),
  setDialogOpen: (openDialog) => set({ openDialog }),
  setPasswordDialog: (open, isRetry = false) => set({ passwordDialogOpen: open, passwordDialogIsRetry: isRetry }),
  setReadingMode: (v) => set({ readingMode: v }),
  setFindBarOpen: (findBarOpen) => set({ findBarOpen }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setCommentBalloon: (commentBalloon) => set({ commentBalloon }),
}));
