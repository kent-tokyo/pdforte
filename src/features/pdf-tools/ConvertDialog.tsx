import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { imagesToPdf } from "./pdfOperations";
import { Dialog, cancelBtnStyle } from "../../components/Dialog";

interface LibreOfficeStatus { found: boolean; path: string; version: string; install_guide: string; }

type Tab = "pdf-to-office" | "office-to-pdf" | "image-to-pdf";

const OFFICE_FORMATS = [
  { value: "docx", label: "Word (.docx)" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
];

export function ConvertDialog() {
  const isOpen = useUiStore(s => s.openDialog === "convert");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { filePath } = usePdfStore();
  const [tab, setTab] = useState<Tab>("pdf-to-office");
  const [officeFormat, setOfficeFormat] = useState("docx");
  const [imageFiles, setImageFiles] = useState<{ path: string; name: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loStatus, setLoStatus] = useState<LibreOfficeStatus | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    invoke<LibreOfficeStatus>("check_libreoffice").then(setLoStatus).catch(() => {});
  }, [isOpen]);

  const close = useCallback(() => {
    setDialogOpen(null);
    setStatus(null); setImageFiles([]);
  }, [setDialogOpen]);

  // PDF → Office
  const handlePdfToOffice = useCallback(async () => {
    if (!filePath) { setStatus("PDFが開いていません"); return; }
    const folder = await invoke<string | null>("open_folder_dialog");
    if (!folder) return;
    setBusy(true); setStatus(null);
    try {
      const outPath = await invoke<string>("convert_via_libreoffice", { inputPath: filePath, format: officeFormat, outputDir: folder });
      setStatus(`変換完了: ${outPath.split("/").pop()}`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [filePath, officeFormat]);

  // Office → PDF
  const handleOfficeToPdf = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    if (!paths.length) return;
    const folder = await invoke<string | null>("open_folder_dialog");
    if (!folder) return;
    setBusy(true); setStatus(null);
    try {
      for (const p of paths) {
        await invoke("convert_via_libreoffice", { inputPath: p, format: "pdf", outputDir: folder });
      }
      setStatus(`${paths.length} ファイルを PDF に変換しました`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // Image → PDF
  const handleAddImages = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    const imgPaths = paths.filter((p) => /\.(jpg|jpeg|png)$/i.test(p));
    setImageFiles((prev) => [...prev, ...imgPaths.map((p) => ({ path: p, name: p.split("/").pop() ?? p }))]);
  }, []);

  const handleImagesToPdf = useCallback(async () => {
    if (imageFiles.length === 0) { setStatus("画像ファイルを追加してください"); return; }
    setBusy(true); setStatus(null);
    try {
      const fileData = await Promise.all(imageFiles.map(async (f) => {
        const rawBytes = await invoke<number[]>("read_file_bytes", { path: f.path });
        return { bytes: new Uint8Array(rawBytes), name: f.name };
      }));
      const pdfBytes = await imagesToPdf(fileData);
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "images.pdf" });
      if (!outPath) { setBusy(false); return; }
      await invoke("save_pdf", { path: outPath, bytes: Array.from(pdfBytes) });
      setStatus(`保存しました: ${outPath.split("/").pop()}`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [imageFiles]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="変換">
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {([["pdf-to-office", "PDF → Office"], ["office-to-pdf", "Office → PDF"], ["image-to-pdf", "画像 → PDF"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setStatus(null); }}
              style={{ flex: 1, padding: "8px 4px", fontSize: 11, background: tab === id ? "var(--bg-secondary)" : "var(--bg-toolbar)", border: "none", borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent", color: tab === id ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* LibreOffice status banner */}
        {loStatus && !loStatus.found && (
          <div style={{ margin: "12px 16px 0", padding: "10px 12px", background: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e74c3c", marginBottom: 4 }}>⚠ LibreOffice が見つかりません</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{loStatus.install_guide}</div>
          </div>
        )}
        {loStatus && loStatus.found && (
          <div style={{ margin: "12px 16px 0", padding: "6px 12px", background: "rgba(39,174,96,0.1)", borderRadius: 6, fontSize: 11, color: "#27ae60" }}>
            ✓ {loStatus.version}
          </div>
        )}

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "pdf-to-office" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                現在のPDFを Office 形式に変換します (LibreOffice が必要)。<br />
                ファイル: {filePath?.split("/").pop() ?? "未開封"}
              </p>
              <div>
                <label style={labelStyle}>変換形式</label>
                <select value={officeFormat} onChange={(e) => setOfficeFormat(e.target.value)} style={selectStyle}>
                  {OFFICE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <button onClick={handlePdfToOffice} disabled={busy || !filePath} style={{ ...actionBtnStyle, opacity: busy || !filePath ? 0.5 : 1 }}>
                {busy ? "変換中..." : "出力フォルダを選択して変換"}
              </button>
            </>
          )}

          {tab === "office-to-pdf" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Word / Excel / PPT ファイルを PDF に変換します (LibreOffice が必要)。</p>
              <button onClick={handleOfficeToPdf} disabled={busy} style={{ ...actionBtnStyle, opacity: busy ? 0.5 : 1 }}>
                {busy ? "変換中..." : "ファイルを選択して変換"}
              </button>
            </>
          )}

          {tab === "image-to-pdf" && (
            <>
              <button onClick={handleAddImages} style={addBtnStyle}>+ 画像を追加 (JPEG / PNG)</button>
              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {imageFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--bg-primary)", borderRadius: 3 }}>
                    <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={() => setImageFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#e34850", cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={handleImagesToPdf} disabled={busy || imageFiles.length === 0} style={{ ...actionBtnStyle, opacity: busy || imageFiles.length === 0 ? 0.5 : 1 }}>
                {busy ? "変換中..." : `PDF に変換 (${imageFiles.length} 枚)`}
              </button>
            </>
          )}

          {status && <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>{status}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={close} style={cancelBtnStyle}>閉じる</button>
          </div>
        </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
const addBtnStyle: React.CSSProperties = { padding: "7px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer", background: "var(--bg-primary)", border: "1px dashed var(--border)", color: "var(--text-primary)" };
const actionBtnStyle: React.CSSProperties = { padding: "6px 14px", fontSize: 12, borderRadius: 4, cursor: "pointer", background: "var(--accent)", border: "none", color: "#fff", width: "100%" };
