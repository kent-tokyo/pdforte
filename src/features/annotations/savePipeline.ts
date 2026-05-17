import { invoke } from "@tauri-apps/api/core";
import type { AnnotationMap, Annotation, SignatureAnnotation, StampAnnotation } from "./annotationTypes";

function dataUrlToBytes(dataUrl: string): number[] {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) throw new Error("Invalid dataUrl: missing comma separator");
  const base64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Array.from(bytes);
}

function serializeAnnotation(ann: Annotation): object {
  if (ann.type === "signature" || ann.type === "stamp") {
    const a = ann as SignatureAnnotation | StampAnnotation;
    const { dataUrl, ...rest } = a;
    return { ...rest, imageBytes: dataUrlToBytes(dataUrl) };
  }
  return ann;
}

export async function embedAnnotationsAndSave(
  originalBytes: Uint8Array,
  annotations: AnnotationMap
): Promise<Uint8Array> {
  // Flatten all annotations across all pages into a single array
  const flat: object[] = [];
  for (const [, anns] of annotations.entries()) {
    for (const ann of anns) {
      flat.push(serializeAnnotation(ann));
    }
  }

  const result = await invoke<number[]>("bake_annotations", {
    bytes: Array.from(originalBytes),
    annotations: flat,
  });
  return new Uint8Array(result);
}
