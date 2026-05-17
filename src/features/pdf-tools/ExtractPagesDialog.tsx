import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { parsePageRanges } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function ExtractPagesDialog() {
  const { extractPagesDialogOpen, setExtractPagesDialogOpen } = useUiStore();
  const { originalBytes, numPages, filePath } = usePdfStore();
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setExtractPagesDialogOpen(false);
    setRangeStr("");
    setStatus(null);
  }, [setExtractPagesDialogOpen]);

  const handleExtract = useCallback(async () => {
    if (!originalBytes || !filePath) return;
    // Flatten all range groups into one sorted list of 1-indexed page numbers
    const ranges0 = parsePageRanges(rangeStr, numPages);
    if (ranges0.length === 0) {
      setStatus("有効なページ番号を入力してください (例: 1,3,5-8)");
      return;
    }
    const pages0 = [...new Set(ranges0.flat())].sort((a, b) => a - b);
    const pages1 = pages0.map((p) => p + 1); // convert to 1-indexed

    const outPath = await invoke<string | null>("save_file_dialog", {
      defaultName: (filePath.split("/").pop() ?? "extracted").replace(/\.pdf$/i, "") + "_extracted.pdf",
    });
    if (!outPath) return;

    setBusy(true);
    setStatus(null);
    try {
      const bytes = await invoke<number[]>("extract_pages_pdf", {
        bytes: Array.from(originalBytes),
        pages: pages1,
      });
      await invoke("save_bytes", { path: outPath, bytes });
      setStatus(`${pages1.length} ページを抽出しました`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, numPages, rangeStr]);

  return (
    <Dialog isOpen={extractPagesDialogOpen} onClose={close} title="ページを抽出" width={420}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          現在のファイル: {numPages} ページ
        </p>

        <div>
          <label style={labelStyle}>抽出するページ</label>
          <input
            type="text"
            value={rangeStr}
            onChange={(e) => setRangeStr(e.target.value)}
            placeholder="例: 1, 3, 5-8"
            style={inputStyle}
            autoFocus
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            複数のページ・範囲をカンマで区切って入力してください
          </p>
        </div>

        {status && (
          <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e", margin: 0 }}>
            {status}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={handleExtract}
            disabled={busy || !rangeStr.trim()}
            style={{ ...actionBtnStyle, opacity: busy || !rangeStr.trim() ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "保存先を選択して抽出"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 13,
  background: "var(--bg-primary)", border: "1px solid var(--border)",
  borderRadius: 4, color: "var(--text-primary)", boxSizing: "border-box",
};
