import { invoke } from "@tauri-apps/api/core";

export function parsePageRanges(rangeStr: string, numPages: number): number[][] {
  const ranges: number[][] = [];
  for (const part of rangeStr.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const dash = trimmed.match(/^(\d+)-(\d+)$/);
    if (dash) {
      const from = Math.max(1, parseInt(dash[1])) - 1;
      const to = Math.min(numPages, parseInt(dash[2])) - 1;
      if (from <= to) {
        ranges.push(Array.from({ length: to - from + 1 }, (_, i) => from + i));
      }
    } else {
      const page = parseInt(trimmed) - 1;
      if (page >= 0 && page < numPages) ranges.push([page]);
    }
  }
  return ranges;
}

export async function splitPdf(
  originalBytes: Uint8Array,
  ranges: number[][],
  outputFolder: string,
  baseName: string
): Promise<string[]> {
  // ranges is 0-indexed; convert to 1-indexed for harumi
  const ranges1 = ranges.map((r) => r.map((p) => p + 1));
  const parts = await invoke<number[][]>("split_pdf", {
    bytes: Array.from(originalBytes),
    ranges: ranges1,
  });

  const savedPaths: string[] = [];
  const sep = outputFolder.includes("\\") ? "\\" : "/";
  for (let i = 0; i < parts.length; i++) {
    const outPath = `${outputFolder}${sep}${baseName}_part${i + 1}.pdf`;
    await invoke("save_pdf", { path: outPath, bytes: parts[i] });
    savedPaths.push(outPath);
  }
  return savedPaths;
}

export async function reorderPages(
  originalBytes: Uint8Array,
  newOrder: number[]
): Promise<Uint8Array> {
  // newOrder is 0-indexed; convert to 1-indexed for harumi
  const result = await invoke<number[]>("reorder_pages_pdf", {
    bytes: Array.from(originalBytes),
    new_order: newOrder.map((p) => p + 1),
  });
  return new Uint8Array(result);
}

export async function mergePdfs(allBytes: Uint8Array[]): Promise<Uint8Array> {
  const result = await invoke<number[]>("merge_pdfs", {
    pdfs: allBytes.map((b) => Array.from(b)),
  });
  return new Uint8Array(result);
}

export async function rotatePdfPages(
  originalBytes: Uint8Array,
  pageRotations: Map<number, number>
): Promise<Uint8Array> {
  // pageRotations keys are 0-indexed; convert to 1-indexed [[page, degrees]] tuples
  const rotations = [...pageRotations.entries()].map(([idx, deg]) => [idx + 1, deg]);
  const result = await invoke<number[]>("rotate_pages_pdf", {
    bytes: Array.from(originalBytes),
    rotations,
  });
  return new Uint8Array(result);
}

// protectPdf is handled by Rust (qpdf) via invoke("protect_pdf", ...)

export async function imagesToPdf(imageFiles: { bytes: Uint8Array; name: string }[]): Promise<Uint8Array> {
  const result = await invoke<number[]>("create_pdf_from_images", {
    images: imageFiles.map((f) => Array.from(f.bytes)),
    page_width: 0,   // 0 = use each image's natural dimensions
    page_height: 0,
  });
  return new Uint8Array(result);
}

export async function renderPageToImageBytes(
  pdfDoc: import("pdfjs-dist").PDFDocumentProxy,
  pageIndex: number,
  scale: number
): Promise<Uint8Array> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("toBlob failed")); return; }
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, "image/png");
  });
}
