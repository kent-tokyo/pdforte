import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function UnlockPdfDialog() {
  const { unlockDialogOpen, setUnlockDialogOpen } = useUiStore();
  const { originalBytes, filePath } = usePdfStore();
  const { clearAnnotations } = useAnnotationStore();
  const { loadFromBytes } = usePdfjs();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (unlockDialogOpen) {
      setPassword(""); setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [unlockDialogOpen]);

  const close = useCallback(() => setUnlockDialogOpen(false), [setUnlockDialogOpen]);

  const handleUnlock = useCallback(async () => {
    if (!originalBytes) return;
    setBusy(true); setError(null);
    try {
      const stem = (filePath?.replace(/\.pdf$/i, "").split(/[/\\]/).pop() ?? "document");
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${stem}_unlocked.pdf` });
      if (!outPath) { setBusy(false); return; }

      const result = await invoke<number[]>("unlock_pdf", {
        bytes: Array.from(originalBytes),
        password,
      });
      const newBytes = new Uint8Array(result);

      await invoke("save_bytes", { path: outPath, bytes: Array.from(newBytes) });

      // Reload unlocked PDF
      clearAnnotations();
      await loadFromBytes(newBytes, outPath);
      close();
    } catch (err) {
      setError(`${err}`);
    } finally {
      setBusy(false);
    }
  }, [originalBytes, filePath, password, clearAnnotations, loadFromBytes, close]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleUnlock();
    if (e.key === "Escape") close();
  }, [handleUnlock, close]);

  return (
    <Dialog isOpen={unlockDialogOpen} onClose={close} title="🔓 パスワードを解除" width={380}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          PDFの暗号化を解除して保存します。<br />
          現在のパスワードを入力してください。
        </div>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKey}
          placeholder="現在のパスワード"
          style={{
            padding: "8px 10px", fontSize: 13, borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)", color: "var(--text-primary)",
            outline: "none",
          }}
        />
        {error && (
          <div style={{ color: "#e34850", fontSize: 12 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={handleUnlock}
            disabled={busy || !password}
            style={{ ...actionBtnStyle, opacity: busy || !password ? 0.5 : 1 }}
          >
            {busy ? "処理中..." : "解除して保存..."}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
