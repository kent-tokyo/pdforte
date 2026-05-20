import { create } from "zustand";
import type { Annotation, AnnotationMap, AnnotationTool, CreateAnnotation } from "../features/annotations/annotationTypes";
import { nanoid } from "nanoid";

interface AnnotationState {
  annotations: AnnotationMap;
  idToPage: Map<string, number>;
  selectedId: string | null;
  activeTool: AnnotationTool;
  undoStack: AnnotationMap[];
  redoStack: AnnotationMap[];

  addAnnotation: (ann: CreateAnnotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  updateAnnotationSilent: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: AnnotationTool) => void;
  loadAnnotations: (map: AnnotationMap) => void;
  clearAnnotations: () => void;
  undo: () => void;
  redo: () => void;
}

function buildIdToPage(annotations: AnnotationMap): Map<string, number> {
  const map = new Map<string, number>();
  for (const [page, anns] of annotations) {
    for (const ann of anns) map.set(ann.id, page);
  }
  return map;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => {
  // Snapshot the current annotations map for undo history.
  // With immutable page-level updates, new Map() is sufficient —
  // each page's array is replaced (not mutated), so old references stay valid.
  const snapshot = () => new Map(get().annotations) as AnnotationMap;

  const pushUndo = () => ({
    undoStack: [...get().undoStack, snapshot()].slice(-50),
    redoStack: [] as AnnotationMap[],
  });

  return {
    annotations: new Map(),
    idToPage: new Map(),
    selectedId: null,
    activeTool: "select",
    undoStack: [],
    redoStack: [],

    addAnnotation: (annData: CreateAnnotation) => {
      const { annotations, idToPage } = get();
      const ann = {
        ...annData,
        id: nanoid(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Annotation;
      const next = new Map(annotations) as AnnotationMap;
      const pageAnns = next.get(ann.pageIndex) ?? [];
      next.set(ann.pageIndex, [...pageAnns, ann]);
      const newIdToPage = new Map(idToPage);
      newIdToPage.set(ann.id, ann.pageIndex);
      set({ annotations: next, idToPage: newIdToPage, selectedId: ann.id, ...pushUndo() });
    },

    updateAnnotation: (id, patch) => {
      const { annotations, idToPage } = get();
      const page = idToPage.get(id);
      if (page === undefined) return;
      const next = new Map(annotations) as AnnotationMap;
      next.set(
        page,
        annotations.get(page)!.map((a) =>
          a.id === id ? ({ ...a, ...patch, updatedAt: Date.now() } as Annotation) : a
        )
      );
      set({ annotations: next, ...pushUndo() });
    },

    updateAnnotationSilent: (id, patch) => {
      const { annotations, idToPage } = get();
      const page = idToPage.get(id);
      if (page === undefined) return;
      const next = new Map(annotations) as AnnotationMap;
      next.set(
        page,
        annotations.get(page)!.map((a) =>
          a.id === id ? ({ ...a, ...patch, updatedAt: Date.now() } as Annotation) : a
        )
      );
      set({ annotations: next });
    },

    deleteAnnotation: (id) => {
      const { annotations, idToPage } = get();
      const page = idToPage.get(id);
      if (page === undefined) return;
      const next = new Map(annotations) as AnnotationMap;
      next.set(page, annotations.get(page)!.filter((a) => a.id !== id));
      const newIdToPage = new Map(idToPage);
      newIdToPage.delete(id);
      set({ annotations: next, idToPage: newIdToPage, ...pushUndo(), selectedId: null });
    },

    setSelectedId: (selectedId) => set({ selectedId }),
    setActiveTool: (activeTool) => set({ activeTool, selectedId: null }),
    loadAnnotations: (annotations) => set({ annotations, idToPage: buildIdToPage(annotations), undoStack: [], redoStack: [] }),
    clearAnnotations: () => set({ annotations: new Map(), idToPage: new Map(), undoStack: [], redoStack: [], selectedId: null }),

    undo: () => {
      const { undoStack, annotations, redoStack } = get();
      if (undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1];
      set({
        annotations: prev,
        idToPage: buildIdToPage(prev),
        undoStack: undoStack.slice(0, -1),
        redoStack: [new Map(annotations) as AnnotationMap, ...redoStack],
      });
    },

    redo: () => {
      const { redoStack, annotations, undoStack } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[0];
      set({
        annotations: next,
        idToPage: buildIdToPage(next),
        redoStack: redoStack.slice(1),
        undoStack: [...undoStack, new Map(annotations) as AnnotationMap],
      });
    },
  };
});
