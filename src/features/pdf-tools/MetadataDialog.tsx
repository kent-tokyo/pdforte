import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

export function MetadataDialog() {
  const isOpen = useUiStore(s => s.openDialog === "metadata");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, filePath } = usePdfStore();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator, setCreator] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !originalBytes) return;
    (async () => {
      try {
        const meta = await invoke<{
          title: string | null;
          author: string | null;
          subject: string | null;
          keywords: string | null;
          creator: string | null;
        }>("get_pdf_metadata", { bytes: Array.from(originalBytes) });
        setTitle(meta.title ?? "");
        setAuthor(meta.author ?? "");
        setSubject(meta.subject ?? "");
        setKeywords(meta.keywords ?? "");
        setCreator(meta.creator ?? "");
      } catch {}
    })();
  }, [isOpen, originalBytes]);

  const close = useCallback(() => {
    setDialogOpen(null);
    setStatus("idle");
    setMsg("");
  }, [setDialogOpen]);

  const handleClear = () => { setTitle(""); setAuthor(""); setSubject(""); setKeywords(""); setCreator(""); };

  const handleSave = useCallback(async () => {
    if (!originalBytes || !filePath) return;
    setStatus("busy");
    try {
      const newBytes = await invoke<number[]>("set_pdf_metadata", {
        bytes: Array.from(originalBytes),
        meta: { title: title || null, author: author || null, subject: subject || null, keywords: keywords || null, creator: creator || null },
      });
      await invoke("save_bytes", { path: filePath, bytes: newBytes });
      setStatus("done");
      setMsg("保存しました");
    } catch (e) {
      setStatus("error");
      setMsg(String(e));
    }
  }, [originalBytes, filePath, title, author, subject, keywords, creator]);

  const fields: { label: string; value: string; set: (v: string) => void }[] = [
    { label: "タイトル", value: title, set: setTitle },
    { label: "作成者", value: author, set: setAuthor },
    { label: "件名", value: subject, set: setSubject },
    { label: "キーワード (カンマ区切り)", value: keywords, set: setKeywords },
    { label: "Creator", value: creator, set: setCreator },
  ];

  return (
    <Dialog isOpen={isOpen} onClose={close} title="📋 メタデータ編集" width={460}>
      <div style={bodyStyle}>
        {fields.map(({ label, value, set }) => (
          <div key={label}>
            <label style={labelStyle}>{label}</label>
            <input type="text" value={value} onChange={(e) => set(e.target.value)} style={inputStyle} />
          </div>
        ))}
        {status === "done" && <div style={successStyle}>{msg}</div>}
        {status === "error" && <div style={errorStyle}>{msg}</div>}
      </div>
      <div style={footerStyle}>
        <button onClick={handleClear} style={cancelBtnStyle}>すべてクリア</button>
        <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
        <button onClick={handleSave} disabled={!originalBytes || status === "busy"} style={{ ...actionBtnStyle, opacity: !originalBytes ? 0.5 : 1 }}>
          {status === "busy" ? "保存中..." : "保存"}
        </button>
      </div>
    </Dialog>
  );
}

const bodyStyle: React.CSSProperties = { padding: 16, display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" };
const footerStyle: React.CSSProperties = { padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", boxSizing: "border-box" };
const successStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(39,174,96,0.15)", borderRadius: 6, fontSize: 13, color: "#27ae60" };
const errorStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(231,76,60,0.15)", borderRadius: 6, fontSize: 12, color: "#e74c3c" };
