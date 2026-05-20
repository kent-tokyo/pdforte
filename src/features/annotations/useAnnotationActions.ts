import { useShallow } from "zustand/react/shallow";
import { useAnnotationStore } from "../../store/annotationStore";

export function useAnnotationActions() {
  return useAnnotationStore(
    useShallow((s) => ({
      updateAnnotation: s.updateAnnotation,
      updateAnnotationSilent: s.updateAnnotationSilent,
      deleteAnnotation: s.deleteAnnotation,
      setSelectedId: s.setSelectedId,
    }))
  );
}
