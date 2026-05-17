import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function ProtectPdfDialog() {
  const { protectDialogOpen, setProtectDialogOpen } = useUiStore();
  const { filePath } = usePdfStore();
  const [userPw, setUserPw] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setProtectDialogOpen(false);
    setUserPw(""); setOwnerPw(""); setStatus(null);
    setAllowPrint(true); setAllowCopy(false);
  }, [setProtectDialogOpen]);

  const handleApply = useCallback(async () => {
    if (!filePath) { setStatus("PDFが開いていません"); return; }
    if (!userPw && !ownerPw) { setStatus("パスワードを少なくとも1つ入力してください"); return; }
    setBusy(true); setStatus(null);
    try {
      const base = (filePath.split("/").pop() ?? "document").replace(/\.pdf$/i, "");
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${base}_protected.pdf` });
      if (!outPath) { setBusy(false); return; }
      await invoke("protect_pdf", {
        inputPath: filePath,
        outputPath: outPath,
        userPassword: userPw,
        ownerPassword: ownerPw,
        allowPrinting: allowPrint,
        allowCopying: allowCopy,
      });
      setStatus(`保存しました: ${outPath.split("/").pop()}`);
    } catch (err) {
      setStatus(`エラー: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [filePath, userPw, ownerPw, allowPrint, allowCopy]);

  return (
    <Dialog isOpen={protectDialogOpen} onClose={close} title="🔒 PDFを保護" width={400}>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>ユーザーパスワード (閲覧時に必要)</label>
          <input type="password" value={userPw} onChange={(e) => setUserPw(e.target.value)} placeholder="未設定の場合は空欄" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>オーナーパスワード (権限管理用)</label>
          <input type="password" value={ownerPw} onChange={(e) => setOwnerPw(e.target.value)} placeholder="未設定の場合は空欄" style={inputStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>権限設定</label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={allowPrint} onChange={(e) => setAllowPrint(e.target.checked)} />
            印刷を許可
          </label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={allowCopy} onChange={(e) => setAllowCopy(e.target.checked)} />
            テキストコピーを許可
          </label>
        </div>
        {status && <p style={{ fontSize: 12, color: status.startsWith("エラー") ? "#e34850" : "#2da44e" }}>{status}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
          <button onClick={handleApply} disabled={busy} style={{ ...actionBtnStyle, opacity: busy ? 0.5 : 1 }}>
            {busy ? "処理中..." : "保護して保存"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)" };
const checkLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" };
