import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfStore } from "../../store/pdfStore";
import type { Annotation } from "../annotations/annotationTypes";

const VALID_TYPES = new Set([
  "textbox","highlight","underline","strikethrough",
  "signature","stamp","stickynote","callout","shape","pencil","image",
]);

function isValidAnnotation(v: unknown): v is Annotation {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  if (!VALID_TYPES.has(a.type as string)) return false;
  if (typeof a.pageIndex !== "number" || !Number.isFinite(a.pageIndex) || a.pageIndex < 0 || a.pageIndex > 9999) return false;
  if (typeof a.id !== "string" || a.id.length === 0) return false;
  for (const field of ["fontSize", "strokeWidth", "opacity"] as const) {
    if (field in a && (typeof a[field] !== "number" || !Number.isFinite(a[field] as number))) return false;
  }
  if ("dataUrl" in a) {
    const du = a.dataUrl;
    if (typeof du !== "string") return false;
    if (du !== "") {
      if (du.length > 10 * 1024 * 1024) return false;
      if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(du)) return false;
    }
  }
  return true;
}

const TYPE_ICON: Record<string, string> = {
  textbox: "T",
  highlight: "🖊",
  underline: "U̲",
  strikethrough: "S̶",
  signature: "✍",
  stamp: "🔖",
  stickynote: "📌",
  callout: "💬",
};

function preview(ann: Annotation): string {
  if (ann.type === "textbox" || ann.type === "stickynote" || ann.type === "callout") {
    const text = ann.content.slice(0, 22);
    return text || "(空)";
  }
  return ann.type;
}

const STICKY_COLORS = ["#FFD700", "#90EE90", "#87CEEB", "#FFB6C1", "#DDA0DD", "#FFA07A"];

export function AnnotationsPanel() {
  const annotations = useAnnotationStore(s => s.annotations);
  const selectedId = useAnnotationStore(s => s.selectedId);
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation);
  const deleteAnnotation = useAnnotationStore(s => s.deleteAnnotation);
  const setSelectedId = useAnnotationStore(s => s.setSelectedId);
  const loadAnnotations = useAnnotationStore(s => s.loadAnnotations);
  const setCurrentPage = usePdfStore(s => s.setCurrentPage);
  const numPages = usePdfStore(s => s.numPages);

  const allAnnotations = useMemo(() => {
    const result: Annotation[] = [];
    annotations.forEach((anns) => result.push(...anns));
    result.sort((a, b) => a.pageIndex - b.pageIndex || a.createdAt - b.createdAt);
    return result;
  }, [annotations]);

  const selected = selectedId ? allAnnotations.find((a) => a.id === selectedId) ?? null : null;

  const handleSelect = useCallback((ann: Annotation) => {
    setCurrentPage(ann.pageIndex + 1);
    setSelectedId(ann.id);
  }, [setCurrentPage, setSelectedId]);

  const handleExport = useCallback(async () => {
    const obj: Record<number, Annotation[]> = {};
    annotations.forEach((anns, page) => { obj[page] = anns; });
    const json = JSON.stringify(obj, null, 2);
    const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "annotations.annot" });
    if (outPath) {
      await invoke("save_bytes", { path: outPath, bytes: Array.from(new TextEncoder().encode(json)) });
    }
  }, [annotations]);

  const handleImport = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    const annot = paths.find((p) => p.endsWith(".annot"));
    if (!annot) return;
    const raw = await invoke<number[]>("read_file_bytes", { path: annot });
    try {
      const obj = JSON.parse(new TextDecoder().decode(new Uint8Array(raw)));
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        console.error("Import failed: invalid format");
        return;
      }
      const newMap = new Map<number, Annotation[]>();
      for (const [k, v] of Object.entries(obj)) {
        const pageIndex = parseInt(k);
        if (!Number.isFinite(pageIndex) || pageIndex < 0) continue;
        if (!Array.isArray(v)) continue;
        const validAnns = (v as unknown[]).filter(isValidAnnotation).filter((a) => a.pageIndex < numPages);
        if (validAnns.length > 0) newMap.set(pageIndex, validAnns);
      }
      loadAnnotations(newMap);
    } catch (e) {
      console.error("Import failed:", e);
    }
  }, [loadAnnotations]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          注釈 ({allAnnotations.length})
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={handleExport} title="注釈をエクスポート" style={iconBtnStyle}>↑</button>
          <button onClick={handleImport} title="注釈をインポート" style={iconBtnStyle}>↓</button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {allAnnotations.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            注釈がありません
          </div>
        ) : (
          allAnnotations.map((ann) => (
            <div
              key={ann.id}
              onClick={() => handleSelect(ann)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                cursor: "pointer",
                borderLeft: ann.id === selectedId ? "3px solid var(--accent)" : "3px solid transparent",
                background: ann.id === selectedId ? "var(--bg-primary)" : "transparent",
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => { if (ann.id !== selectedId) (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)"; }}
              onMouseLeave={(e) => { if (ann.id !== selectedId) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 13, width: 20, textAlign: "center" }}>{TYPE_ICON[ann.type] ?? "•"}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>p.{ann.pageIndex + 1}</div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview(ann)}</div>
                {ann.comment && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                    💬 {ann.comment.slice(0, 30)}{ann.comment.length > 30 ? "…" : ""}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                style={{ ...iconBtnStyle, color: "#e74c3c", opacity: 0.6 }}
                title="削除"
              >🗑</button>
            </div>
          ))
        )}
      </div>

      {/* Properties panel */}
      {selected && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 10, flexShrink: 0, background: "var(--bg-tertiary)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            プロパティ
          </div>
          <PropertiesPane annotation={selected} updateAnnotation={updateAnnotation} />
        </div>
      )}
    </div>
  );
}

function PropertiesPane({
  annotation,
  updateAnnotation,
}: {
  annotation: Annotation;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
}) {
  if (annotation.type === "textbox") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Row label="フォントサイズ">
          <input
            type="number" min={6} max={72} value={annotation.fontSize}
            onChange={(e) => updateAnnotation(annotation.id, { fontSize: parseInt(e.target.value) || 12 })}
            style={numInputStyle}
          />
        </Row>
        <Row label="文字色">
          <input type="color" value={annotation.fontColor}
            onChange={(e) => updateAnnotation(annotation.id, { fontColor: e.target.value })}
            style={colorInputStyle}
          />
        </Row>
        <Row label="背景色">
          <input type="color" value={annotation.bgColor || "#ffffff"}
            onChange={(e) => updateAnnotation(annotation.id, { bgColor: e.target.value })}
            style={colorInputStyle}
          />
        </Row>
        <Row label="スタイル">
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={annotation.bold}
              onChange={(e) => updateAnnotation(annotation.id, { bold: e.target.checked })} /> Bold
          </label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={annotation.italic}
              onChange={(e) => updateAnnotation(annotation.id, { italic: e.target.checked })} /> Italic
          </label>
        </Row>
      </div>
    );
  }

  if (annotation.type === "highlight" || annotation.type === "underline" || annotation.type === "strikethrough") {
    return (
      <Row label="色">
        <input type="color" value={annotation.color.slice(0, 7)}
          onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
          style={colorInputStyle}
        />
      </Row>
    );
  }

  if (annotation.type === "stamp") {
    return (
      <Row label="透明度">
        <input
          type="range" min={0} max={1} step={0.05} value={annotation.opacity}
          onChange={(e) => updateAnnotation(annotation.id, { opacity: parseFloat(e.target.value) })}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32, textAlign: "right" }}>
          {Math.round(annotation.opacity * 100)}%
        </span>
      </Row>
    );
  }

  if (annotation.type === "stickynote") {
    return (
      <Row label="色">
        <div style={{ display: "flex", gap: 4 }}>
          {STICKY_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => updateAnnotation(annotation.id, { color: c })}
              style={{
                width: 18, height: 18, borderRadius: 3, background: c,
                cursor: "pointer",
                border: annotation.color === c ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </Row>
    );
  }

  if (annotation.type === "callout") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Row label="色">
          <input type="color" value={annotation.color}
            onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
            style={colorInputStyle}
          />
        </Row>
        <Row label="フォントサイズ">
          <input type="number" min={6} max={72} value={annotation.fontSize}
            onChange={(e) => updateAnnotation(annotation.id, { fontSize: parseInt(e.target.value) || 12 })}
            style={numInputStyle}
          />
        </Row>
      </div>
    );
  }

  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", width: 64, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", padding: "2px 4px", borderRadius: 3 };
const numInputStyle: React.CSSProperties = { width: 52, padding: "2px 4px", fontSize: 12, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-primary)" };
const colorInputStyle: React.CSSProperties = { width: 28, height: 22, border: "none", padding: 0, cursor: "pointer", background: "transparent", borderRadius: 3 };
const checkLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--text-primary)", cursor: "pointer" };
