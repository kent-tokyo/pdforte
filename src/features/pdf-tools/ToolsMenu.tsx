import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
}

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pdfDoc } = usePdfStore();
  const { numPages, filePath } = usePdfStore();
  const {
    setSplitDialogOpen, setPageOrderDialogOpen, setMergeDialogOpen,
    setRotateDialogOpen, setExportImagesDialogOpen, setConvertDialogOpen,
    setOcrDialogOpen, setProtectDialogOpen, setTranslateDialogOpen, setPrintDialogOpen,
    setScannerDialogOpen, setSanitizeDialogOpen, setMetadataDialogOpen, setSignatureVerifyDialogOpen,
    setCreatePdfDialogOpen, setExtractPagesDialogOpen, setWatermarkDialogOpen, setPageNumbersDialogOpen,
    setCompressDialogOpen, setFlattenDialogOpen, setUnlockDialogOpen,
  } = useUiStore();

  const hasPdf = !!pdfDoc;

  const handleSaveAsText = useCallback(async () => {
    if (!pdfDoc || numPages === 0) return;
    const pages: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      const text = (tc.items as TextItem[])
        .filter((item) => item.str)
        .map((item) => item.str)
        .join(" ");
      pages.push(text);
    }
    const fullText = pages.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
    const stem = filePath ? filePath.replace(/\.pdf$/i, "").split(/[/\\]/).pop()! : "document";
    const outPath = await invoke<string | null>("save_file_dialog", { defaultName: stem + ".txt" });
    if (outPath) {
      await invoke("save_bytes", { path: outPath, bytes: Array.from(new TextEncoder().encode(fullText)) });
    }
  }, [pdfDoc, numPages, filePath]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  const action = useCallback((fn: () => void) => () => { fn(); close(); }, [close]);

  const sections: { heading: string; items: MenuItem[] }[] = [
    {
      heading: "整理",
      items: [
        { icon: "🗜", label: "PDF 圧縮", action: action(() => setCompressDialogOpen(true)), disabled: !hasPdf },
        { icon: "📋", label: "PDFをフラット化（注釈を焼き込み）", action: action(() => setFlattenDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔗", label: "PDF 結合", action: action(() => setMergeDialogOpen(true)) },
        { icon: "✂", label: "PDF 分割", action: action(() => setSplitDialogOpen(true)), disabled: !hasPdf },
        { icon: "⇅", label: "ページ並び替え / 削除", action: action(() => setPageOrderDialogOpen(true)), disabled: !hasPdf },
        { icon: "📑", label: "ページを抽出", action: action(() => setExtractPagesDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔄", label: "ページ回転", action: action(() => setRotateDialogOpen(true)), disabled: !hasPdf },
        { icon: "🖊", label: "ウォーターマークを追加", action: action(() => setWatermarkDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔢", label: "ページ番号を追加", action: action(() => setPageNumbersDialogOpen(true)), disabled: !hasPdf },
      ],
    },
    {
      heading: "変換・エクスポート",
      items: [
        { icon: "🖼", label: "PDF → JPEG / PNG", action: action(() => setExportImagesDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔁", label: "変換 (Office・画像)", action: action(() => setConvertDialogOpen(true)) },
        { icon: "📷", label: "PDFスキャナー（画像→PDF）", action: action(() => setScannerDialogOpen(true)) },
        { icon: "📄", label: "PDFを作成", action: action(() => setCreatePdfDialogOpen(true)) },
        { icon: "💾", label: "テキストとして保存", action: action(() => { handleSaveAsText(); }), disabled: !hasPdf },
      ],
    },
    {
      heading: "AI ツール",
      items: [
        { icon: "🌐", label: "PDFを翻訳", action: action(() => setTranslateDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔍", label: "OCR (テキスト認識)", action: action(() => setOcrDialogOpen(true)), disabled: !hasPdf },
      ],
    },
    {
      heading: "セキュリティ・情報",
      items: [
        { icon: "🔒", label: "PDFを保護", action: action(() => setProtectDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔓", label: "パスワードを解除", action: action(() => setUnlockDialogOpen(true)), disabled: !hasPdf },
        { icon: "🧹", label: "PDFサニタイズ", action: action(() => setSanitizeDialogOpen(true)), disabled: !hasPdf },
        { icon: "🔐", label: "署名の検証", action: action(() => setSignatureVerifyDialogOpen(true)), disabled: !hasPdf },
        { icon: "📋", label: "メタデータ編集", action: action(() => setMetadataDialogOpen(true)), disabled: !hasPdf },
        { icon: "🖨", label: "印刷...", action: action(() => setPrintDialogOpen(true)), disabled: !hasPdf },
      ],
    },
  ];

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 32, padding: "0 10px", display: "flex", alignItems: "center", gap: 4,
          borderRadius: 4, fontSize: 12, color: open ? "#fff" : "var(--text-primary)",
          background: open ? "var(--accent)" : "transparent", border: "none", cursor: "pointer", flexShrink: 0,
        }}
      >
        ツール ▾
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          zIndex: 500, minWidth: 240, padding: "4px 0",
        }}>
          {sections.map((sec) => (
            <div key={sec.heading}>
              <div style={{ padding: "5px 12px 2px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {sec.heading}
              </div>
              {sec.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.disabled}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 14px", fontSize: 12, background: "transparent", border: "none",
                    color: item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                    cursor: item.disabled ? "default" : "pointer", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
