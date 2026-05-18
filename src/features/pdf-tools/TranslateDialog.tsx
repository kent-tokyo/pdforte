import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfStore } from "../../store/pdfStore";
import { useAnnotationStore } from "../../store/annotationStore";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { Dialog } from "../../components/Dialog";

const TARGET_LANGS = [
  { code: "JA", label: "日本語" },
  { code: "EN", label: "English" },
  { code: "ZH", label: "中文（简体）" },
  { code: "KO", label: "한국어" },
  { code: "DE", label: "Deutsch" },
  { code: "FR", label: "Français" },
  { code: "ES", label: "Español" },
  { code: "IT", label: "Italiano" },
  { code: "PT", label: "Português" },
];

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

/** PDFページからテキストブロック（行グループ）を抽出する */
async function extractBlocks(page: import("pdfjs-dist").PDFPageProxy): Promise<TextBlock[]> {
  const tc = await page.getTextContent();
  const items = (tc.items as TextItem[]).filter((i) => i.str.trim());

  if (items.length === 0) return [];

  // y座標でグループ化（2pt以内は同一行）
  const lineMap = new Map<number, TextItem[]>();
  for (const item of items) {
    const ry = Math.round(item.transform[5] / 3) * 3;
    if (!lineMap.has(ry)) lineMap.set(ry, []);
    lineMap.get(ry)!.push(item);
  }

  // 行をy降順（上から下）でソート
  const sortedLines = [...lineMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([y, its]) => ({ y, items: its.sort((a, b) => a.transform[4] - b.transform[4]) }));

  // 行をパラグラフにグループ化（ギャップ > 行高さの2倍で区切る）
  const paragraphs: typeof sortedLines[] = [];
  let current: typeof sortedLines = [];
  let prevY: number | null = null;

  for (const line of sortedLines) {
    const lineHeight = Math.abs(line.items[0]?.transform[3] ?? 12);
    if (prevY === null || prevY - line.y < lineHeight * 2.5) {
      current.push(line);
    } else {
      if (current.length > 0) paragraphs.push(current);
      current = [line];
    }
    prevY = line.y;
  }
  if (current.length > 0) paragraphs.push(current);

  // パラグラフをTextBlockに変換
  return paragraphs.map((lines): TextBlock => {
    const allItems = lines.flatMap((l) => l.items);
    const xs = allItems.map((i) => i.transform[4]);
    const ys = allItems.map((i) => i.transform[5]);
    const x2s = allItems.map((i) => i.transform[4] + (i.width ?? 0));
    const y2s = allItems.map((i) => i.transform[5] + Math.abs(i.transform[3]));
    const text = lines.map((l) => l.items.map((i) => i.str).join(" ")).join("\n");
    const fontSize = Math.abs(allItems[0]?.transform[3] ?? 12);
    const pdfX = Math.min(...xs);
    const pdfY = Math.min(...ys);
    const pdfW = Math.max(...x2s) - pdfX;
    const pdfH = Math.max(...y2s) - pdfY;

    return {
      text,
      x: pdfX,
      y: pdfY,
      width: Math.max(pdfW, fontSize * 5),
      height: Math.max(pdfH, fontSize),
      fontSize: Math.max(fontSize, 8),
    };
  });
}

export function TranslateDialog() {
  const isOpen = useUiStore(s => s.openDialog === "translate");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { pdfDoc, currentPage, numPages } = usePdfStore();
  const { addAnnotation } = useAnnotationStore();

  const [targetLang, setTargetLang] = useState("JA");
  const [pageMode, setPageMode] = useState<"current" | "range" | "all">("current");
  const [rangeInput, setRangeInput] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [engine, setEngine] = useState("deepl");
  const [apiKey, setApiKey] = useState("");

  // 設定からAPIキーと翻訳エンジンをロード
  useEffect(() => {
    if (!isOpen) return;
    invoke<string>("read_settings").then((json) => {
      try {
        const s = JSON.parse(json);
        if (s.translationEngine) setEngine(s.translationEngine);
        if (s.translationApiKey) setApiKey(s.translationApiKey);
      } catch {}
    });
  }, [isOpen]);

  const parsePageRange = useCallback((input: string): number[] => {
    const pages: number[] = [];
    for (const part of input.split(",")) {
      const [a, b] = part.trim().split("-").map(Number);
      if (b) {
        for (let p = a; p <= b; p++) if (p >= 1 && p <= numPages) pages.push(p);
      } else if (a >= 1 && a <= numPages) {
        pages.push(a);
      }
    }
    return [...new Set(pages)].sort((a, b) => a - b);
  }, [numPages]);

  const getTargetPages = useCallback((): number[] => {
    if (pageMode === "current") return [currentPage];
    if (pageMode === "all") return Array.from({ length: numPages }, (_, i) => i + 1);
    return parsePageRange(rangeInput);
  }, [pageMode, currentPage, numPages, rangeInput, parsePageRange]);

  const handleTranslate = useCallback(async () => {
    if (!pdfDoc) return;
    if (!apiKey.trim()) { setErrorMsg("APIキーが設定されていません。設定画面で入力してください。"); setStatus("error"); return; }

    const pages = getTargetPages();
    if (pages.length === 0) { setErrorMsg("有効なページ範囲を入力してください"); setStatus("error"); return; }

    setStatus("running");
    setErrorMsg("");
    setProgress({ current: 0, total: pages.length });

    try {
      for (let pi = 0; pi < pages.length; pi++) {
        const pageNum = pages[pi];
        setProgress({ current: pi + 1, total: pages.length });

        const page = await pdfDoc.getPage(pageNum);
        const blocks = await extractBlocks(page);

        for (const block of blocks) {
          if (!block.text.trim()) continue;
          let translated: string;
          try {
            translated = await invoke<string>("translate_text", {
              text: block.text,
              targetLang,
              engine,
              apiKey,
            });
          } catch (err) {
            console.error("Translation failed for block:", err);
            continue;
          }

          addAnnotation({
            type: "textbox",
            pageIndex: pageNum - 1,
            pdfRect: {
              x: block.x,
              y: block.y,
              width: block.width,
              height: block.height,
            },
            content: translated,
            fontSize: Math.round(block.fontSize),
            fontColor: "#000000",
            bgColor: "rgba(255,255,255,0.95)",
            bold: false,
            italic: false,
            lang: targetLang.toLowerCase().startsWith("ja") ? "ja"
              : targetLang.toLowerCase().startsWith("zh") ? "zh-CN"
              : targetLang.toLowerCase().startsWith("ko") ? "ko"
              : "en",
          });
        }
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  }, [pdfDoc, apiKey, engine, getTargetPages, targetLang, addAnnotation]);

  const handleClose = () => {
    setStatus("idle");
    setErrorMsg("");
    setProgress(null);
    setDialogOpen(null);
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="PDFを翻訳" width={460}>
      <div style={{ padding: 24 }}>
        {/* Engine / API key info */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, padding: "8px 12px", background: "var(--bg-tertiary)", borderRadius: 6 }}>
          エンジン: <strong style={{ color: "var(--text-secondary)" }}>{engine}</strong>
          {apiKey ? " ✓ APIキー設定済み" : " ⚠ APIキー未設定 (設定画面で入力してください)"}
        </div>

        {/* Target language */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>翻訳先言語</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={selectStyle}
          >
            {TARGET_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Page range */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>翻訳するページ</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {(["current", "range", "all"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPageMode(mode)}
                style={{
                  padding: "5px 12px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                  background: pageMode === mode ? "var(--accent)" : "var(--bg-tertiary)",
                  color: pageMode === mode ? "#fff" : "var(--text-primary)",
                  border: "none",
                }}
              >
                {mode === "current" ? `現在のページ (${currentPage})` : mode === "range" ? "範囲指定" : "全ページ"}
              </button>
            ))}
          </div>
          {pageMode === "range" && (
            <input
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="例: 1-3, 5, 8-10"
              style={selectStyle}
            />
          )}
        </div>

        {/* Progress */}
        {status === "running" && progress && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              翻訳中... {progress.current} / {progress.total} ページ
            </div>
            <div style={{ height: 4, background: "var(--bg-tertiary)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(progress.current / progress.total) * 100}%`,
                background: "var(--accent)",
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}

        {status === "done" && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "rgba(39,174,96,0.15)", borderRadius: 6, fontSize: 13, color: "#27ae60" }}>
            ✓ 翻訳完了。ページ上のテキストボックスに結果が表示されています。
          </div>
        )}

        {status === "error" && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "rgba(231,76,60,0.15)", borderRadius: 6, fontSize: 12, color: "#e74c3c" }}>
            {errorMsg}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={handleClose} style={cancelBtnStyle}>キャンセル</button>
          <button
            onClick={handleTranslate}
            disabled={status === "running" || !pdfDoc}
            style={{
              ...confirmBtnStyle,
              opacity: status === "running" ? 0.6 : 1,
              cursor: status === "running" ? "not-allowed" : "pointer",
            }}
          >
            {status === "running" ? "翻訳中..." : "翻訳開始"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 };
const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, fontSize: 13 };
const cancelBtnStyle: React.CSSProperties = { padding: "8px 20px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 };
const confirmBtnStyle: React.CSSProperties = { padding: "8px 20px", borderRadius: 4, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600 };
