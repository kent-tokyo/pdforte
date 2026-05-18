import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

function basename(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

export function SanitizeDialog() {
  const isOpen = useUiStore(s => s.openDialog === "sanitize");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { originalBytes, filePath } = usePdfStore();

  const [removeJS, setRemoveJS] = useState(true);
  const [removeEmbedded, setRemoveEmbedded] = useState(true);
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const close = useCallback(() => {
    setDialogOpen(null);
    setStatus("idle");
    setMsg("");
  }, [setDialogOpen]);

  const handleSanitize = useCallback(async () => {
    if (!originalBytes) return;
    setStatus("busy");
    setMsg("");
    try {
      const cleanBytes = await invoke<number[]>("sanitize_pdf", {
        bytes: Array.from(originalBytes),
        remove_js: removeJS,
        remove_embedded: removeEmbedded,
        remove_metadata: removeMetadata,
      });
      const stem = filePath ? basename(filePath).replace(/\.pdf$/i, "") : "document";
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: `${stem}_sanitized.pdf` });
      if (outPath) {
        await invoke("save_bytes", { path: outPath, bytes: cleanBytes });
        const done: string[] = [];
        if (removeJS) done.push("JavaScript除去");
        if (removeEmbedded) done.push("埋め込みファイル除去");
        if (removeMetadata) done.push("メタデータクリア");
        setStatus("done");
        setMsg(`完了 — ${done.join(" / ")}`);
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error");
      setMsg(String(e));
    }
  }, [originalBytes, filePath, removeJS, removeEmbedded, removeMetadata]);

  return (
    <Dialog isOpen={isOpen} onClose={close} title="🧹 PDF サニタイズ" width={460}>
      <div style={bodyStyle}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          PDFに含まれる危険なコンテンツを除去します。処理後は新しいファイルとして保存されます。
        </p>

        {[
          { label: "JavaScript / OpenAction を除去", desc: "起動時スクリプト、フォームアクションを削除します", value: removeJS, set: setRemoveJS },
          { label: "埋め込みファイルを除去", desc: "PDF内に添付されたファイルを削除します", value: removeEmbedded, set: setRemoveEmbedded },
          { label: "メタデータをクリア", desc: "作成者・タイトル・日時などの情報を消去します", value: removeMetadata, set: setRemoveMetadata },
        ].map(({ label, desc, value, set }) => (
          <label key={label} style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
            <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</div>
            </div>
          </label>
        ))}

        {status === "done" && <div style={successStyle}>{msg}</div>}
        {status === "error" && <div style={errorStyle}>{msg}</div>}
      </div>
      <div style={footerStyle}>
        <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
        <button
          onClick={handleSanitize}
          disabled={!originalBytes || status === "busy" || (!removeJS && !removeEmbedded && !removeMetadata)}
          style={{ ...actionBtnStyle, opacity: !originalBytes || status === "busy" ? 0.5 : 1 }}
        >
          {status === "busy" ? "処理中..." : "🧹 サニタイズ実行"}
        </button>
      </div>
    </Dialog>
  );
}

const bodyStyle: React.CSSProperties = { padding: 16, display: "flex", flexDirection: "column", gap: 14 };
const footerStyle: React.CSSProperties = { padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)" };
const successStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(39,174,96,0.15)", borderRadius: 6, fontSize: 13, color: "#27ae60" };
const errorStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(231,76,60,0.15)", borderRadius: 6, fontSize: 12, color: "#e74c3c" };
