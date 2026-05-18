import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { parsePageRanges, renderPageToImageBytes } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

const DPI_OPTIONS = [72, 150, 300];
const FORMAT_OPTIONS = ["PNG", "JPEG"] as const;
type Format = typeof FORMAT_OPTIONS[number];

export function ExportImagesDialog() {
  const isOpen = useUiStore(s => s.openDialog === "exportImages");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { pdfDoc, numPages, filePath } = usePdfStore();
  const [rangeStr, setRangeStr] = useState("");
  const [format, setFormat] = useState<Format>("PNG");
  const [dpi, setDpi] = useState(150);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const close = useCallback(() => {
    setDialogOpen(null);
    setRangeStr(""); setStatus(null); setProgress("");
  }, [setDialogOpen]);

  const handleExport = useCallback(async () => {
    if (!pdfDoc) return;
    const ranges = rangeStr.trim()
      ? parsePageRanges(rangeStr, numPages).flat()
      : Array.from({ length: numPages }, (_, i) => i);
    if (ranges.length === 0) { setStatus("有効なページ範囲を入力してください"); return; }

    const folder = await invoke<string | null>("open_folder_dialog");
    if (!folder) return;

    setBusy(true); setStatus(null);
    const base = (filePath?.split("/").pop() ?? "page").replace(/\.pdf$/i, "");
    const sep = folder.includes("\\") ? "\\" : "/";
    const scale = dpi / 72;

    try {
      let done = 0;
      for (const pageIdx of ranges) {
        setProgress(`${done + 1} / ${ranges.length} ページを処理中...`);
        const imgBytes = await renderPageToImageBytes(pdfDoc, pageIdx, scale);
        const ext = format === "JPEG" ? "jpg" : "png";
        const outPath = `${folder}${sep}${base}_p${String(pageIdx + 1).padStart(3, "0")}.${ext}`;
        await invoke("save_bytes", { path: outPath, bytes: Array.from(imgBytes) });
        done++;
      }
      setProgress("");
      setStatus(`${done} 枚の画像を保存しました`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [pdfDoc, numPages, filePath, rangeStr, format, dpi]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="🖼 PDF → 画像エクスポート" width={420}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>全 {numPages} ページ</p>
        <div>
          <label style={labelStyle}>ページ範囲 (空欄で全ページ)</label>
          <input type="text" value={rangeStr} onChange={(e) => setRangeStr(e.target.value)} placeholder="例: 1-3, 5, 7-10 (空欄=全ページ)" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>形式</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} style={selectStyle}>
              {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>解像度</label>
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} style={selectStyle}>
              {DPI_OPTIONS.map((d) => <option key={d} value={d}>{d} DPI</option>)}
            </select>
          </div>
        </div>
        {progress && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{progress}</p>}
        {status && <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>{status}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handleExport} disabled={busy} style={{ ...actionBtnStyle, opacity: busy ? 0.5 : 1 }}>
            {busy ? "エクスポート中..." : "フォルダを選択してエクスポート"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
