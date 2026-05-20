export interface AnnotationBase {
  id: string;
  pageIndex: number;
  pdfRect: { x: number; y: number; width: number; height: number };
  createdAt: number;
  updatedAt: number;
  comment?: string;
}

export interface TextBoxAnnotation extends AnnotationBase {
  type: "textbox";
  content: string;
  fontSize: number;       // PDF points (for save pipeline)
  fontFamily?: string;    // CSS font-family (for on-screen rendering only)
  fontColor: string;
  bgColor: string;
  bold: boolean;
  italic: boolean;
  lang: "ja" | "en" | "zh-CN" | "zh-TW" | "ko";
}

export interface HighlightAnnotation extends AnnotationBase {
  type: "highlight" | "underline" | "strikethrough";
  color: string;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface SignatureAnnotation extends AnnotationBase {
  type: "signature";
  dataUrl: string;
}

export interface StampAnnotation extends AnnotationBase {
  type: "stamp";
  dataUrl: string;
  opacity: number;
}

export interface StickyNoteAnnotation extends AnnotationBase {
  type: "stickynote";
  content: string;
  color: string; // hex color for the note background
}

export interface CalloutAnnotation extends AnnotationBase {
  type: "callout";
  content: string;
  color: string;
  fontSize: number;
  tailPdfX: number; // PDF coordinates of the arrow tip
  tailPdfY: number;
}

export interface ShapeAnnotation extends AnnotationBase {
  type: "shape";
  shape: "rect" | "ellipse" | "line" | "arrow" | "polygon";
  strokeColor: string;  // hex
  fillColor: string;    // hex or "" for transparent
  strokeWidth: number;  // PDF points
  opacity: number;      // 0–1
  // line/arrow endpoints in PDF coordinates
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // polygon vertices in PDF coordinates
  points?: Array<[number, number]>;
}

export interface ImageAnnotation extends AnnotationBase {
  type: "image";
  dataUrl: string;   // data:image/...;base64,...
  opacity: number;   // 0–1
}

export interface PencilAnnotation extends AnnotationBase {
  type: "pencil";
  points: Array<[number, number]>; // PDF coordinates [x, y]
  color: string;        // hex
  strokeWidth: number;  // PDF points
  opacity: number;      // 0–1
}

export type Annotation =
  | TextBoxAnnotation
  | HighlightAnnotation
  | SignatureAnnotation
  | StampAnnotation
  | StickyNoteAnnotation
  | CalloutAnnotation
  | ShapeAnnotation
  | PencilAnnotation
  | ImageAnnotation;

export type AnnotationTool =
  | "select"
  | "hand"
  | "textbox"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "signature"
  | "stamp"
  | "stickynote"
  | "callout"
  | "shape-rect"
  | "shape-ellipse"
  | "shape-line"
  | "shape-arrow"
  | "shape-polygon"
  | "pencil"
  | "image-add";

export type AnnotationMap = Map<number, Annotation[]>;

export type CreateAnnotation =
  | Omit<TextBoxAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<HighlightAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<SignatureAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<StampAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<StickyNoteAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<CalloutAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<ShapeAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<PencilAnnotation, "id" | "createdAt" | "updatedAt">
  | Omit<ImageAnnotation, "id" | "createdAt" | "updatedAt">;
