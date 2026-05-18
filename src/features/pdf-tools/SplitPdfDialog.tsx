import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { parsePageRanges, splitPdf } from "./pdfOperations";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function SplitPdfDialog() {
  const isOpen = useUiStore(s => s.openDialog === "split");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, numPages, filePath } = usePdfStore();
  const [rangeStr, setRangeStr] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setDialogOpen(null);
    setRangeStr("");
    setStatus(null);
  }, [setDialogOpen]);

  const handleSplit = useCallback(async () => {
    if (!originalBytes || !filePath) return;
    const ranges = parsePageRanges(rangeStr, numPages);
    if (ranges.length === 0) {
      setStatus("有効なページ範囲を入力してください (例: 1-3, 4-6)");
      return;
    }

    const folder = await invoke<string | null>("open_folder_dialog");
    if (!folder) return;

    setBusy(true);
    setStatus(null);
    try {
      const base = (filePath.split("/").pop() ?? filePath.split("\\").pop() ?? "document").replace(/\.pdf$/i, "");
      const saved = await splitPdf(originalBytes, ranges, folder, base);
      setStatus(`${saved.length} ファイルを保存しました`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, numPages, rangeStr]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="PDF 分割" width={420}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          現在のファイル: {numPages} ページ
        </p>

        <div>
          <label style={labelStyle}>ページ範囲 (カンマ区切り)</label>
          <input
            type="text"
            value={rangeStr}
            onChange={(e) => setRangeStr(e.target.value)}
            placeholder="例: 1-3, 4-6, 7-10"
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            各範囲が1つのファイルになります。全ページ: 1-{numPages}
          </p>
        </div>

        {status && (
          <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>
            {status}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={handleSplit}
            disabled={busy || !rangeStr.trim()}
            style={{ ...actionBtnStyle, opacity: busy || !rangeStr.trim() ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "フォルダを選択して分割"}
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
  borderRadius: 4, color: "var(--text-primary)",
};
