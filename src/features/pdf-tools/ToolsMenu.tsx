import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileDown, FileText, Files, Scissors, ArrowUpDown, Layers, RotateCw,
  FileImage, Hash, ImageDown, FileOutput, ScanLine, FilePlus,
  Layers2, Languages, ScanText, Lock, Unlock, ShieldCheck, BadgeCheck,
  FileEdit, Printer, ChevronDown,
} from "lucide-react";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";

interface MenuItem {
  label: string;
  icon: ReactNode;
  action: () => void;
  disabled?: boolean;
}

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pdfDoc } = usePdfStore();
  const { numPages, filePath } = usePdfStore();
  const setDialogOpen = useUiStore(s => s.setDialogOpen);

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
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (open) {
      document.addEventListener("mousedown", onMouse);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const action = useCallback((fn: () => void) => () => { fn(); close(); }, [close]);

  const s = 14;
  const sections: { heading: string; items: MenuItem[] }[] = [
    {
      heading: "整理",
      items: [
        { icon: <FileDown size={s} />,    label: "PDF 圧縮",               action: action(() => setDialogOpen("compress")),    disabled: !hasPdf },
        { icon: <Layers2 size={s} />,     label: "PDFをフラット化（注釈を焼き込み）", action: action(() => setDialogOpen("flatten")),    disabled: !hasPdf },
        { icon: <Files size={s} />,       label: "PDF 結合",               action: action(() => setDialogOpen("merge")) },
        { icon: <Scissors size={s} />,    label: "PDF 分割",               action: action(() => setDialogOpen("split")),       disabled: !hasPdf },
        { icon: <ArrowUpDown size={s} />, label: "ページ並び替え / 削除",   action: action(() => setDialogOpen("pageOrder")),   disabled: !hasPdf },
        { icon: <Layers size={s} />,      label: "ページを抽出",           action: action(() => setDialogOpen("extractPages")), disabled: !hasPdf },
        { icon: <RotateCw size={s} />,    label: "ページ回転",             action: action(() => setDialogOpen("rotate")),      disabled: !hasPdf },
        { icon: <FileImage size={s} />,   label: "ウォーターマークを追加", action: action(() => setDialogOpen("watermark")),   disabled: !hasPdf },
        { icon: <Hash size={s} />,        label: "ページ番号を追加",       action: action(() => setDialogOpen("pageNumbers")), disabled: !hasPdf },
      ],
    },
    {
      heading: "変換・エクスポート",
      items: [
        { icon: <ImageDown size={s} />,   label: "PDF → JPEG / PNG",      action: action(() => setDialogOpen("exportImages")), disabled: !hasPdf },
        { icon: <FileOutput size={s} />,  label: "変換 (Office・画像)",    action: action(() => setDialogOpen("convert")) },
        { icon: <ScanLine size={s} />,    label: "PDFスキャナー（画像→PDF）", action: action(() => setDialogOpen("scanner")) },
        { icon: <FilePlus size={s} />,    label: "PDFを作成",              action: action(() => setDialogOpen("createPdf")) },
        { icon: <FileText size={s} />,    label: "テキストとして保存",     action: action(() => { handleSaveAsText(); }),       disabled: !hasPdf },
      ],
    },
    {
      heading: "AI ツール",
      items: [
        { icon: <Languages size={s} />,   label: "PDFを翻訳",             action: action(() => setDialogOpen("translate")),    disabled: !hasPdf },
        { icon: <ScanText size={s} />,    label: "OCR (テキスト認識)",    action: action(() => setDialogOpen("ocr")),          disabled: !hasPdf },
      ],
    },
    {
      heading: "セキュリティ・情報",
      items: [
        { icon: <Lock size={s} />,        label: "PDFを保護",             action: action(() => setDialogOpen("protect")),      disabled: !hasPdf },
        { icon: <Unlock size={s} />,      label: "パスワードを解除",      action: action(() => setDialogOpen("unlock")),       disabled: !hasPdf },
        { icon: <ShieldCheck size={s} />, label: "PDFサニタイズ",         action: action(() => setDialogOpen("sanitize")),     disabled: !hasPdf },
        { icon: <BadgeCheck size={s} />,  label: "署名の検証",            action: action(() => setDialogOpen("signatureVerify")), disabled: !hasPdf },
        { icon: <FileEdit size={s} />,    label: "メタデータ編集",        action: action(() => setDialogOpen("metadata")),     disabled: !hasPdf },
        { icon: <Printer size={s} />,     label: "印刷...",               action: action(() => setDialogOpen("print")),        disabled: !hasPdf },
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
        ツール <ChevronDown size={12} />
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
              <div style={{ padding: "5px 12px 2px", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                  <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</span>
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
