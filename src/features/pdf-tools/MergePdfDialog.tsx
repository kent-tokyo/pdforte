import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { mergePdfs } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

interface FileEntry { path: string; name: string; bytes: Uint8Array | null }

export function MergePdfDialog() {
  const { mergeDialogOpen, setMergeDialogOpen } = useUiStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => { setMergeDialogOpen(false); setFiles([]); setStatus(null); }, [setMergeDialogOpen]);

  const addFiles = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    if (!paths.length) return;
    const newEntries: FileEntry[] = await Promise.all(
      paths.filter((p) => p.toLowerCase().endsWith(".pdf")).map(async (p) => {
        const result = await invoke<{ bytes: number[] }>("open_pdf", { path: p });
        return { path: p, name: p.split("/").pop() ?? p.split("\\").pop() ?? p, bytes: new Uint8Array(result.bytes) };
      })
    );
    setFiles((prev) => [...prev, ...newEntries]);
  }, []);

  const removeFile = useCallback((idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx)), []);
  const moveUp = useCallback((idx: number) => setFiles((prev) => { if (idx === 0) return prev; const n = [...prev]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; }), []);
  const moveDown = useCallback((idx: number) => setFiles((prev) => { if (idx >= prev.length - 1) return prev; const n = [...prev]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n; }), []);

  const handleMerge = useCallback(async () => {
    const validFiles = files.filter((f) => f.bytes);
    if (validFiles.length < 2) { setStatus("PDFファイルを2つ以上追加してください"); return; }
    setBusy(true); setStatus(null);
    try {
      const allBytes = validFiles.map((f) => f.bytes!);
      const merged = await mergePdfs(allBytes);
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "merged.pdf" });
      if (!outPath) { setBusy(false); return; }
      await invoke("save_pdf", { path: outPath, bytes: Array.from(merged) });

      const shouldOpen = window.confirm(`結合完了: ${outPath}\n\nこのファイルを開きますか？`);
      if (shouldOpen) {
        clearAnnotations();
        await loadFromBytes(merged, outPath);
        close();
      } else {
        setStatus(`保存しました: ${outPath}`);
      }
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [files, clearAnnotations, loadFromBytes, close]);

  return (
    <Dialog isOpen={mergeDialogOpen} onClose={close} title="PDF 結合">
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={addFiles} style={addBtnStyle}>+ PDFファイルを追加</button>
        <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {files.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>PDFをここに追加してください</p>}
          {files.map((f, i) => (
            <div key={i} style={rowStyle}>
              <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {f.name}</span>
              <button onClick={() => moveUp(i)} disabled={i === 0} style={iconBtnStyle}>▲</button>
              <button onClick={() => moveDown(i)} disabled={i === files.length - 1} style={iconBtnStyle}>▼</button>
              <button onClick={() => removeFile(i)} style={{ ...iconBtnStyle, color: "#e34850" }}>✕</button>
            </div>
          ))}
        </div>
        {status && <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>{status}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handleMerge} disabled={busy || files.length < 2} style={{ ...actionBtnStyle, opacity: busy || files.length < 2 ? 0.5 : 1 }}>
            {busy ? "処理中..." : `結合 (${files.length} ファイル)`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const addBtnStyle: React.CSSProperties = { padding: "7px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer", background: "var(--bg-primary)", border: "1px dashed var(--border)", color: "var(--text-primary)" };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", background: "var(--bg-primary)", borderRadius: 4, border: "1px solid var(--border)" };
const iconBtnStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 11, padding: "2px 4px" };
