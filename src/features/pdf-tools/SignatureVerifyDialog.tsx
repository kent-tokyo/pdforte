import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog, actionBtnStyle } from "../../components/Dialog";

interface SigInfo {
  name: string;
  date: string;
  reason: string;
}

export function SignatureVerifyDialog() {
  const { signatureVerifyDialogOpen, setSignatureVerifyDialogOpen } = useUiStore();
  const { originalBytes } = usePdfStore();

  const [sigs, setSigs] = useState<SigInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signatureVerifyDialogOpen || !originalBytes) return;
    setLoading(true);
    setSigs([]);
    (async () => {
      try {
        const fields = await invoke<{ name: string; reason: string | null; date: string | null }[]>(
          "get_signature_fields",
          { bytes: Array.from(originalBytes) }
        );
        setSigs(
          fields.map((f) => ({
            name: f.name,
            date: f.date ?? "",
            reason: f.reason ?? "",
          }))
        );
      } catch {}
      setLoading(false);
    })();
  }, [signatureVerifyDialogOpen, originalBytes]);

  const close = () => setSignatureVerifyDialogOpen(false);

  return (
    <Dialog isOpen={signatureVerifyDialogOpen} onClose={close} title="🔐 署名の検証">
      <div style={bodyStyle}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>確認中...</p>
        ) : sigs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
            このPDFには署名フィールドがありません
          </div>
        ) : (
          sigs.map((s, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, background: "var(--bg-primary)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                🖋 {s.name}
              </div>
              {s.date && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>日時: {s.date}</div>}
              {s.reason && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>理由: {s.reason}</div>}
              <div style={{ fontSize: 11, color: "#f39c12", marginTop: 6 }}>
                ⚠ 署名情報を表示しています。暗号的な検証は行われていません。
              </div>
            </div>
          ))
        )}
        <div style={{ padding: "8px 12px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 11, color: "var(--text-muted)" }}>
          完全な署名検証には Adobe Acrobat などの専用ツールをご使用ください。
        </div>
      </div>
      <div style={footerStyle}>
        <button onClick={close} style={actionBtnStyle}>閉じる</button>
      </div>
    </Dialog>
  );
}


const bodyStyle: React.CSSProperties = { padding: 16, display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" };
const footerStyle: React.CSSProperties = { padding: "10px 16px", display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)" };
