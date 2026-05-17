import { useAnnotationStore } from "../../store/annotationStore";

export function useAnnotationActions() {
  return useAnnotationStore((s) => ({
    updateAnnotation: s.updateAnnotation,
    deleteAnnotation: s.deleteAnnotation,
    setSelectedId: s.setSelectedId,
  }));
}
