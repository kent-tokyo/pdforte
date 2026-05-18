import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

type Preset = "low" | "medium" | "high";

const PRESETS: Record<Preset, { label: string; quality: number; maxPx: number; desc: string }> = {
  low:    { label: "低画質",  quality: 40, maxPx: 1000, desc: "品質40% / 最大1000px" },
  medium: { label: "中画質",  quality: 72, maxPx: 1500, desc: "品質72% / 最大1500px" },
  high:   { label: "高画質",  quality: 85, maxPx: 2500, desc: "品質85% / 最大2500px" },
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function CompressDialog() {
  const isOpen = useUiStore(s => s.openDialog === "compress");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, filePath } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();

  const [preset, setPreset] = useState<Preset>("medium");
  const [removeMeta, setRemoveMeta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; size: number } | null>(null);

  const close = useCallback(() => {
    setDialogOpen(null);
    setResult(null);
    setBusy(false);
    setError(null);
  }, [setDialogOpen]);

  const handleCompress = useCallback(async () => {
    if (!originalBytes) return;
    setBusy(true);
    setResult(null);
    try {
      const p = PRESETS[preset];
      const out = await invoke<number[]>("compress_pdf", {
        bytes: Array.from(originalBytes),
        imageQuality: p.quality,
        maxImagePixels: p.maxPx,
        removeMetadata: removeMeta,
      });
      const newBytes = new Uint8Array(out);
      setResult({ bytes: newBytes, size: newBytes.length });
    } catch (err) {
      setError(`圧縮エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, preset, removeMeta]);

  const handleApply = useCallback(async () => {
    if (!result || !filePath) return;
    clearAnnotations();
    await loadFromBytes(result.bytes, filePath);
    close();
  }, [result, filePath, clearAnnotations, loadFromBytes, close]);

  const handleSaveAs = useCallback(async () => {
    if (!result) return;
    const stem = filePath?.replace(/\.pdf$/i, "").split(/[/\\]/).pop() ?? "document";
    const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${stem}_compressed.pdf` });
    if (outPath) {
      await invoke("save_bytes", { path: outPath, bytes: Array.from(result.bytes) });
    }
  }, [result, filePath]);

  const origSize = originalBytes?.length ?? 0;
  const ratio = result ? Math.round((1 - result.size / origSize) * 100) : null;

  return (
    <Dialog isOpen={isOpen} onClose={close} title="PDF を圧縮">
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Current size */}
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          現在のファイルサイズ: <strong style={{ color: "var(--text-primary)" }}>{fmt(origSize)}</strong>
        </div>

        {/* Preset buttons */}
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>画質プリセット</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.entries(PRESETS) as [Preset, typeof PRESETS[Preset]][]).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 5, cursor: "pointer",
                  border: preset === key ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: preset === key ? "var(--accent)22" : "var(--bg-primary)",
                  color: "var(--text-primary)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Remove metadata */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={removeMeta} onChange={(e) => setRemoveMeta(e.target.checked)} />
          メタデータを削除 (XMP・ドキュメント情報)
        </label>

        {/* Result */}
        {result && (
          <div style={{
            background: "var(--bg-primary)", border: "1px solid var(--border)",
            borderRadius: 5, padding: "10px 12px", fontSize: 12,
          }}>
            <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>圧縮結果</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {fmt(origSize)} → {fmt(result.size)}
              {ratio !== null && ratio > 0 && (
                <span style={{ color: "#27ae60", marginLeft: 8 }}>({ratio}% 削減)</span>
              )}
              {ratio !== null && ratio <= 0 && (
                <span style={{ color: "#e34850", marginLeft: 8 }}>(削減なし)</span>
              )}
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "#e34850", margin: 0 }}>{error}</p>}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          {!result ? (
            <button
              onClick={handleCompress}
              disabled={busy || !originalBytes}
              style={{ ...actionBtnStyle, opacity: busy || !originalBytes ? 0.5 : 1 }}
            >
              {busy ? "処理中..." : "圧縮する"}
            </button>
          ) : (
            <>
              <button onClick={handleCompress} disabled={busy} style={{ ...cancelBtnStyle }}>
                再圧縮
              </button>
              <button onClick={handleSaveAs} style={cancelBtnStyle}>別名で保存...</button>
              <button onClick={handleApply} style={actionBtnStyle}>適用</button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
