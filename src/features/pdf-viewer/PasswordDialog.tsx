import { useState, useCallback, useEffect, useRef } from "react";
import { useUiStore } from "../../store/uiStore";
import { submitPassword } from "./usePdfjs";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function PasswordDialog() {
  const { passwordDialogOpen, passwordDialogIsRetry, setPasswordDialog } = useUiStore();
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (passwordDialogOpen) {
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [passwordDialogOpen]);

  const handleSubmit = useCallback(() => {
    submitPassword(password);
    setPasswordDialog(false);
  }, [password, setPasswordDialog]);

  const handleCancel = useCallback(() => {
    submitPassword(""); // cancel loading by sending empty → PDF.js aborts
    setPasswordDialog(false);
  }, [setPasswordDialog]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") handleCancel();
  }, [handleSubmit, handleCancel]);

  return (
    <Dialog isOpen={passwordDialogOpen} onClose={handleCancel} title="🔒 パスワードで保護されたPDF" width={360} zIndex={2000}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {passwordDialogIsRetry && (
          <div style={{ color: "#e34850", fontSize: 12 }}>パスワードが正しくありません。再度入力してください。</div>
        )}
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          このPDFを開くにはパスワードが必要です。
        </div>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKey}
          placeholder="パスワードを入力..."
          style={{
            padding: "8px 10px", fontSize: 13, borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)", color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={handleCancel} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handleSubmit} style={{ ...actionBtnStyle, opacity: password ? 1 : 0.5 }} disabled={!password}>OK</button>
        </div>
      </div>
    </Dialog>
  );
}
