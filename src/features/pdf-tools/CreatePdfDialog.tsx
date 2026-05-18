import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { Dialog, actionBtnStyle } from "../../components/Dialog";

type Tab = "image" | "text";
type PageSize = "a4" | "letter" | "a3" | "original";

const PAGE_SIZES: Record<Exclude<PageSize, "original">, [number, number]> = {
  a4:     [595.28, 841.89],
  letter: [612,    792],
  a3:     [841.89, 1190.55],
};

function basename(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

// ── Image → PDF ──────────────────────────────────────────────────────────────

function ImageTab() {
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const addImages = useCallback(async () => {
    const paths = await invoke<string[]>("open_files_dialog");
    setImagePaths((prev) => [...prev, ...paths.filter((p) => /\.(jpg|jpeg|png)$/i.test(p))]);
  }, []);

  const remove = (i: number) => setImagePaths((prev) => prev.filter((_, idx) => idx !== i));
  const moveUp = (i: number) => setImagePaths((prev) => {
    if (i === 0) return prev;
    const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a;
  });
  const moveDown = (i: number) => setImagePaths((prev) => {
    if (i === prev.length - 1) return prev;
    const a = [...prev]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a;
  });

  const handleCreate = useCallback(async () => {
    if (imagePaths.length === 0) return;
    setStatus("busy"); setMsg("");
    try {
      const images: number[][] = [];
      for (const p of imagePaths) {
        const raw = await invoke<number[]>("read_file_bytes", { path: p });
        images.push(raw);
      }
      const [pageWidth, pageHeight] = pageSize === "original" ? [0, 0] : PAGE_SIZES[pageSize];
      const pdfBytes = await invoke<number[]>("create_pdf_from_images", {
        images,
        page_width: pageWidth,
        page_height: pageHeight,
      });
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "document.pdf" });
      if (outPath) {
        await invoke("save_bytes", { path: outPath, bytes: pdfBytes });
        setStatus("done"); setMsg(`保存しました: ${basename(outPath)}`);
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error"); setMsg(String(e));
    }
  }, [imagePaths, pageSize]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={addImages} style={actionBtnStyle}>＋ 画像を追加</button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>JPEG / PNG</span>
      </div>

      {imagePaths.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 6 }}>
          画像を追加してください
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
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
          <option value="a4">A4 (210×297mm)</option>
          <option value="letter">Letter (215.9×279.4mm)</option>
          <option value="a3">A3 (297×420mm)</option>
          <option value="original">元の画像サイズ</option>
        </select>
      </div>

      {status === "done" && <div style={successStyle}>{msg}</div>}
      {status === "error" && <div style={errorStyle}>{msg}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCreate}
          disabled={imagePaths.length === 0 || status === "busy"}
          style={{ ...actionBtnStyle, opacity: imagePaths.length === 0 || status === "busy" ? 0.5 : 1 }}
        >
          {status === "busy" ? "作成中..." : "📄 PDFを作成"}
        </button>
      </div>
    </div>
  );
}

// ── Text → PDF ───────────────────────────────────────────────────────────────

function TextTab() {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [pageSize, setPageSize] = useState<Exclude<PageSize, "original">>("a4");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const handleCreate = useCallback(async () => {
    if (!text.trim()) return;
    setStatus("busy"); setMsg("");
    try {
      // Load a font from bundled resources (requires Phase 9 fonts)
      let fontBytes: number[];
      try {
        fontBytes = await invoke<number[]>("load_font", { font_name: "NotoSansJP-Regular.ttf" });
      } catch {
        try {
          const fonts = await invoke<string[]>("list_fonts");
          if (fonts.length === 0) throw new Error("no fonts");
          fontBytes = await invoke<number[]>("load_font", { font_name: fonts[0] });
        } catch {
          setStatus("error");
          setMsg("フォントが見つかりません。Phase 9 でフォントファイルを src-tauri/fonts/ に配置してください。");
          return;
        }
      }

      const [pw, ph] = PAGE_SIZES[pageSize];
      const pdfBytes = await invoke<number[]>("create_pdf_from_text_content", {
        text,
        font_bytes: fontBytes,
        page_width: pw,
        page_height: ph,
        font_size: fontSize,
      });
      const outPath = await invoke<string | null>("save_file_dialog", { defaultName: "document.pdf" });
      if (outPath) {
        await invoke("save_bytes", { path: outPath, bytes: pdfBytes });
        setStatus("done"); setMsg(`保存しました: ${basename(outPath)}`);
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error"); setMsg(String(e));
    }
  }, [text, fontSize, pageSize]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>用紙サイズ</label>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as Exclude<PageSize, "original">)} style={inputStyle}>
            <option value="a4">A4 (210×297mm)</option>
            <option value="letter">Letter (215.9×279.4mm)</option>
            <option value="a3">A3 (297×420mm)</option>
          </select>
        </div>
        <div style={{ width: 100 }}>
          <label style={labelStyle}>フォントサイズ</label>
          <input
            type="number" min={6} max={72} value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>テキスト内容</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここにテキストを入力..."
          style={{
            width: "100%", height: 200, padding: "8px", fontSize: 13,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
            borderRadius: 4, color: "var(--text-primary)", resize: "vertical",
            boxSizing: "border-box", fontFamily: "sans-serif",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
          ※ 自動で改ページされます。日本語・CJK文字対応（src-tauri/fonts/ にフォントが必要）
        </div>
      </div>

      {status === "done" && <div style={successStyle}>{msg}</div>}
      {status === "error" && <div style={errorStyle}>{msg}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCreate}
          disabled={!text.trim() || status === "busy"}
          style={{ ...actionBtnStyle, opacity: !text.trim() || status === "busy" ? 0.5 : 1 }}
        >
          {status === "busy" ? "作成中..." : "📄 PDFを作成"}
        </button>
      </div>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function CreatePdfDialog() {
  const isOpen = useUiStore(s => s.openDialog === "createPdf");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const [tab, setTab] = useState<Tab>("image");

  return (
    <Dialog isOpen={isOpen} onClose={() => setDialogOpen(null)} title="📄 PDFを作成" width={520}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {([["image", "🖼 画像から"], ["text", "📝 テキストから"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "9px 12px", fontSize: 12, border: "none", cursor: "pointer",
              background: tab === t ? "var(--bg-secondary)" : "var(--bg-tertiary)",
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: tab === t ? `2px solid var(--accent)` : "2px solid transparent",
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === "image" ? <ImageTab /> : <TextTab />}
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 13, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", boxSizing: "border-box" as const };
const iconBtnStyle: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", padding: "2px 4px" };
const successStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(39,174,96,0.15)", borderRadius: 6, fontSize: 13, color: "#27ae60" };
const errorStyle: React.CSSProperties = { padding: "8px 12px", background: "rgba(231,76,60,0.15)", borderRadius: 6, fontSize: 12, color: "#e74c3c" };
