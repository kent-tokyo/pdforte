import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { parsePageRanges, renderPageToImageBytes, mergePdfs } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

const LANG_OPTIONS = [
  { value: "jpn+eng", label: "日本語 + 英語" },
  { value: "jpn", label: "日本語" },
  { value: "eng", label: "英語" },
  { value: "chi_sim+eng", label: "中国語(簡体) + 英語" },
  { value: "chi_tra+eng", label: "中国語(繁体) + 英語" },
  { value: "kor+eng", label: "韓国語 + 英語" },
];

type Mode = "extract" | "textlayer";

export function OcrDialog() {
  const isOpen = useUiStore(s => s.openDialog === "ocr");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { pdfDoc, numPages, filePath } = usePdfStore();
  const [mode, setMode] = useState<Mode>("extract");
  const [rangeStr, setRangeStr] = useState("");
  const [lang, setLang] = useState("jpn+eng");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const close = useCallback(() => {
    setDialogOpen(null);
    setRangeStr(""); setResult(""); setStatus(null); setProgress("");
  }, [setDialogOpen]);

  const getPageIndices = useCallback(() => {
    if (!rangeStr.trim()) return Array.from({ length: numPages }, (_, i) => i);
    return parsePageRanges(rangeStr, numPages).flat();
  }, [rangeStr, numPages]);

  const handleExtract = useCallback(async () => {
    if (!pdfDoc) return;
    const pageIndices = getPageIndices();
    if (pageIndices.length === 0) { setStatus("有効なページ範囲を入力してください"); return; }
    setBusy(true); setResult(""); setStatus(null);
    const texts: string[] = [];
    try {
      for (let i = 0; i < pageIndices.length; i++) {
        const pageIdx = pageIndices[i];
        setProgress(`OCR処理中: ${i + 1} / ${pageIndices.length} ページ (p.${pageIdx + 1})`);
        const imgBytes = await renderPageToImageBytes(pdfDoc, pageIdx, 2.0);
        const text = await invoke<string>("ocr_page", { imageBytes: Array.from(imgBytes), lang });
        texts.push(`--- ページ ${pageIdx + 1} ---\n${text.trim()}`);
      }
      setProgress("");
      setResult(texts.join("\n\n"));
      setStatus(`${pageIndices.length} ページの OCR が完了しました`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [pdfDoc, numPages, getPageIndices, lang]);

  const handleTextLayer = useCallback(async () => {
    if (!pdfDoc) return;
    const pageIndices = getPageIndices();
    if (pageIndices.length === 0) { setStatus("有効なページ範囲を入力してください"); return; }
    setBusy(true); setResult(""); setStatus(null);
    const pagePdfs: Uint8Array[] = [];
    try {
      for (let i = 0; i < pageIndices.length; i++) {
        const pageIdx = pageIndices[i];
        setProgress(`OCR処理中: ${i + 1} / ${pageIndices.length} ページ (p.${pageIdx + 1})`);
        const imgBytes = await renderPageToImageBytes(pdfDoc, pageIdx, 2.0);
        const pdfBytes = await invoke<number[]>("ocr_page_to_pdf", { imageBytes: Array.from(imgBytes), lang });
        pagePdfs.push(new Uint8Array(pdfBytes));
      }
      setProgress("ページを結合中...");
      const merged = await mergePdfs(pagePdfs);
      setProgress("");

      const stem = (filePath?.split("/").pop() ?? "document").replace(/\.pdf$/i, "");
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${stem}_ocr.pdf` });
      if (outPath) {
        await invoke("save_bytes", { path: outPath, bytes: Array.from(merged) });
        setStatus(`検索可能なPDFを保存しました`);
      } else {
        setStatus(null);
      }
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [pdfDoc, filePath, getPageIndices, lang]);

  const handleSaveText = useCallback(async () => {
    if (!result) return;
    const base = (filePath?.split("/").pop() ?? "ocr").replace(/\.pdf$/i, "");
    const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${base}_ocr.txt` });
    if (!outPath) return;
    await invoke("save_bytes", { path: outPath, bytes: Array.from(new TextEncoder().encode(result)) });
  }, [result, filePath]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="🔍 PDF OCR" width={520}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {([["extract", "テキスト抽出"], ["textlayer", "テキストレイヤーを追加 (検索可能化)"]] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: "7px 12px", fontSize: 12, border: "none", cursor: "pointer",
                background: mode === m ? "var(--accent)" : "var(--bg-tertiary)",
                color: mode === m ? "#fff" : "var(--text-primary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ページ範囲 (空欄で全ページ)</label>
            <input type="text" value={rangeStr} onChange={(e) => setRangeStr(e.target.value)} placeholder="例: 1-3, 5" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>言語</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={selectStyle}>
              {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {mode === "textlayer" && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "6px 10px", background: "var(--bg-tertiary)", borderRadius: 6 }}>
            各ページを高解像度画像に変換してTesseractでPDFを生成し、検索可能なPDFとして保存します。<br />
            ※ Tesseract がインストールされている必要があります。
          </div>
        )}

        {progress && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{progress}</p>}
        {status && <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>{status}</p>}

        {mode === "extract" && result && (
          <textarea
            readOnly value={result}
            style={{ width: "100%", height: 200, fontSize: 12, fontFamily: "monospace", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", padding: 8, resize: "vertical" }}
          />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {mode === "extract" && result && <button onClick={handleSaveText} style={cancelBtnStyle}>テキストファイルとして保存</button>}
          <button onClick={close} style={cancelBtnStyle}>閉じる</button>
          <button
            onClick={mode === "extract" ? handleExtract : handleTextLayer}
            disabled={busy}
            style={{ ...actionBtnStyle, opacity: busy ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : mode === "extract" ? "OCR 実行" : "テキストレイヤーを追加"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
