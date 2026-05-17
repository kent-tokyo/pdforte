import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { Dialog, cancelBtnStyle, actionBtnStyle } from "../../components/Dialog";

type PageSize = "original" | "a4" | "letter";

function basename(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

export function ScannerDialog() {
  const { scannerDialogOpen, setScannerDialogOpen } = useUiStore();
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("original");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const close = useCallback(() => {
    setScannerDialogOpen(false);
    setImagePaths([]);
    setStatus("idle");
    setMsg("");
  }, [setScannerDialogOpen]);

  const addImages = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    const imgs = paths.filter((p) => /\.(jpg|jpeg|png)$/i.test(p));
    setImagePaths((prev) => [...prev, ...imgs]);
  }, []);

  const remove = (idx: number) => setImagePaths((prev) => prev.filter((_, i) => i !== idx));
  const moveUp = (idx: number) => setImagePaths((prev) => {
    if (idx === 0) return prev;
    const next = [...prev];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    return next;
  });
  const moveDown = (idx: number) => setImagePaths((prev) => {
    if (idx === prev.length - 1) return prev;
    const next = [...prev];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    return next;
  });

  const PAGE_PT: Record<Exclude<PageSize, "original">, [number, number]> = {
    a4: [595.28, 841.89],
    letter: [612, 792],
  };

  const handleCreate = useCallback(async () => {
    if (imagePaths.length === 0) return;
    setStatus("busy");
    setMsg("");
    try {
      const images: number[][] = [];
      for (const p of imagePaths) {
        images.push(await invoke<number[]>("read_file_bytes", { path: p }));
      }
      const [pageWidth, pageHeight] = pageSize === "original" ? [0, 0] : PAGE_PT[pageSize];
      const pdfBytes = await invoke<number[]>("create_pdf_from_images", {
        images,
        page_width: pageWidth,
        page_height: pageHeight,
      });
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "scan.pdf" });
      if (outPath) {
        await invoke("save_bytes", { path: outPath, bytes: pdfBytes });
        setStatus("done");
        setMsg(`保存しました: ${basename(outPath)}`);
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error");
      setMsg(String(e));
    }
  }, [imagePaths, pageSize]);

  return (
    <Dialog isOpen={scannerDialogOpen} onClose={close} title="📷 PDFスキャナー（画像→PDF）" width={500}>
      <div style={bodyStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={addImages} style={actionBtnStyle}>＋ 画像を追加</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>JPEG / PNG</span>
        </div>

        {imagePaths.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 6 }}>
            画像を追加してください
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
            {imagePaths.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderBottom: i < imagePaths.length - 1 ? "1px solid var(--border)" : undefined }}>
                <span style={{ color: "var(--text-muted)", fontSize: 11, width: 20, textAlign: "right" }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{basename(p)}</span>
                <button onClick={() => moveUp(i)} disabled={i === 0} style={iconBtnStyle}>↑</button>
                <button onClick={() => moveDown(i)} disabled={i === imagePaths.length - 1} style={iconBtnStyle}>↓</button>
                <button onClick={() => remove(i)} style={{ ...iconBtnStyle, color: "#e74c3c" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label style={labelStyle}>用紙サイズ</label>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} style={inputStyle}>
            <option value="original">元の画像サイズ</option>
            <option value="a4">A4 (210×297mm)</option>
            <option value="letter">Letter (215.9×279.4mm)</option>
          </select>
        </div>

        {status === "done" && <div style={successStyle}>{msg}</div>}
        {status === "error" && <div style={errorStyle}>{msg}</div>}
      </div>
      <div style={footerStyle}>
        <button onClick={close} style={cancelBtnStyle}>キャンセル</button>
        <button
          onClick={handleCreate}
          disabled={imagePaths.length === 0 || status === "busy"}
          style={{ ...actionBtnStyle, opacity: imagePaths.length === 0 || status === "busy" ? 0.5 : 1 }}
        >
          {status === "busy" ? "作成中..." : "📄 PDFを作成"}
        </button>
      </div>
    </Dialog>
  );
}

const bodyStyle: React.CSSProperties = { padding: 16, display: "flex", flexDirection: "column", gap: 12 };
const footerStyle: React.CSSProperties = { padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", boxSizing: "border-box" };
const iconBtnStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", padding: "2px 4px" };
const successStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(39,174,96,0.15)", borderRadius: 6, fontSize: 13, color: "#27ae60" };
const errorStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(231,76,60,0.15)", borderRadius: 6, fontSize: 12, color: "#e74c3c" };
