import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { usePdfStore } from "../store/pdfStore";
import { useAnnotationStore } from "../store/annotationStore";
import { useUiStore } from "../store/uiStore";
import { usePdfjs } from "../features/pdf-viewer/usePdfjs";
import { useSavePdf } from "../features/annotations/useSavePdf";
import { useRecentFilesStore } from "../store/recentFilesStore";
import { setPendingImageData } from "../features/annotations/pendingImage";

export function useMenuEvents() {
  const pdfStore = usePdfStore();
  const annotationStore = useAnnotationStore();
  const uiStore = useUiStore();
  const { loadFromBytes } = usePdfjs();
  const { save, saveAs } = useSavePdf();
  const { recentFiles } = useRecentFilesStore();

  const ref = useRef({
    pdfStore,
    annotationStore,
    uiStore,
    loadFromBytes,
    save,
    saveAs,
    recentFiles,
  });
  ref.current = { pdfStore, annotationStore, uiStore, loadFromBytes, save, saveAs, recentFiles };

  useEffect(() => {
    const unlistens: Array<() => void> = [];
    let cancelled = false;

    const push = (u: () => void) => { if (cancelled) u(); else unlistens.push(u); };

    const setup = async () => {
      push(
        await listen("menu:open", async () => {
          const { loadFromBytes } = ref.current;
          try {
            const path = await invoke<string | null>("open_file_dialog");
            if (!path) return;
            const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>(
              "open_pdf", { path }
            );
            await loadFromBytes(new Uint8Array(result.bytes), result.file_path);
          } catch (err) {
            console.error("Open failed:", err);
          }
        })
      );

      push(await listen("menu:save", () => ref.current.save()));
      push(await listen("menu:save-as", () => ref.current.saveAs()));

      push(
        await listen("menu:close", () => {
          ref.current.pdfStore.close();
          ref.current.annotationStore.clearAnnotations();
        })
      );

      // 最近使ったファイルを開く → ホーム画面の一覧に誘導（サイドバーに切り替え）
      push(
        await listen("menu:open-recent", () => {
          ref.current.uiStore.setSidebarOpen(true);
        })
      );

      // ファイルを結合
      push(await listen("menu:merge", () => ref.current.uiStore.setMergeDialogOpen(true)));
      // Word/Excel/PowerPoint に変換
      push(await listen("menu:convert", () => ref.current.uiStore.setConvertDialogOpen(true)));
      push(await listen("menu:compress", () => ref.current.uiStore.setCompressDialogOpen(true)));
      // パスワードを保護
      push(await listen("menu:protect", () => ref.current.uiStore.setProtectDialogOpen(true)));
      // 簡易検索 → 検索サイドバーを開く
      push(
        await listen("menu:find", () => {
          ref.current.uiStore.setSidebarOpen(true);
          ref.current.uiStore.setSidebarTab("search");
        })
      );
      // 高度な検索 (現時点は簡易検索と同じ)
      push(
        await listen("menu:find-advanced", () => {
          ref.current.uiStore.setSidebarOpen(true);
          ref.current.uiStore.setSidebarTab("search");
        })
      );
      // 文書のプロパティ → MetadataDialog を開く
      push(
        await listen("menu:properties", () => {
          if (!ref.current.pdfStore.pdfDoc) return;
          ref.current.uiStore.setMetadataDialogOpen(true);
        })
      );

      // 編集メニュー
      push(await listen("menu:undo", () => ref.current.annotationStore.undo()));
      push(await listen("menu:redo", () => ref.current.annotationStore.redo()));
      push(
        await listen("menu:edit-pdf", () => {
          ref.current.annotationStore.setActiveTool("select");
        })
      );
      push(
        await listen("menu:add-textbox", () => {
          ref.current.annotationStore.setActiveTool("textbox");
        })
      );
      push(await listen("menu:add-image", async () => {
        try {
          const path = await invoke<string | null>("open_image_dialog");
          if (!path) return;
          const rawBytes = await invoke<number[]>("read_file_bytes", { path });
          const uint8 = new Uint8Array(rawBytes);
          const ext = path.split(".").pop()?.toLowerCase() ?? "png";
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
            : ext === "gif" ? "image/gif"
            : ext === "webp" ? "image/webp"
            : "image/png";
          const binary = uint8.reduce((acc, b) => acc + String.fromCharCode(b), "");
          const dataUrl = `data:${mime};base64,${btoa(binary)}`;
          setPendingImageData(dataUrl);
          ref.current.annotationStore.setActiveTool("image-add" as import("../features/annotations/annotationTypes").AnnotationTool);
        } catch (err) {
          console.error("Image insert failed:", err);
        }
      }));
      push(await listen("menu:delete-pages", () => ref.current.uiStore.setPageOrderDialogOpen(true)));
      push(await listen("menu:rotate-pages", () => ref.current.uiStore.setRotateDialogOpen(true)));
      push(await listen("menu:organize-pages", () => ref.current.uiStore.setPageOrderDialogOpen(true)));
      push(await listen("menu:ocr", () => ref.current.uiStore.setOcrDialogOpen(true)));
      push(
        await listen("menu:print", () => {
          window.print();
        })
      );

      push(
        await listen("menu:zoom-in", () => {
          const { zoom, setZoom } = ref.current.pdfStore;
          setZoom(Math.min(zoom * 1.25, 5));
        })
      );
      push(
        await listen("menu:zoom-out", () => {
          const { zoom, setZoom } = ref.current.pdfStore;
          setZoom(Math.max(zoom * 0.8, 0.1));
        })
      );
      push(await listen("menu:zoom-reset", () => ref.current.pdfStore.setZoom(1.0)));
      push(await listen("menu:zoom-fit", () => ref.current.pdfStore.setZoom(1.0)));

      push(await listen("menu:first-page", () => ref.current.pdfStore.setCurrentPage(1)));
      push(
        await listen("menu:prev-page", () => {
          const { currentPage, setCurrentPage } = ref.current.pdfStore;
          setCurrentPage(Math.max(1, currentPage - 1));
        })
      );
      push(
        await listen("menu:next-page", () => {
          const { currentPage, numPages, setCurrentPage } = ref.current.pdfStore;
          setCurrentPage(Math.min(numPages, currentPage + 1));
        })
      );
      push(
        await listen("menu:last-page", () => {
          const { numPages, setCurrentPage } = ref.current.pdfStore;
          setCurrentPage(numPages);
        })
      );

      const applyTheme = async (theme: "dark" | "light" | "system") => {
        const effective = theme === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : theme;
        document.documentElement.setAttribute("data-theme", effective);
        try {
          const raw = await invoke<string>("read_settings");
          const settings = JSON.parse(raw || "{}");
          settings.theme = theme === "system" ? effective : theme;
          await invoke("write_settings", { json: JSON.stringify(settings, null, 2) });
        } catch { /* ignore */ }
      };

      push(await listen("menu:theme-dark",   () => applyTheme("dark")));
      push(await listen("menu:theme-light",  () => applyTheme("light")));
      push(await listen("menu:theme-system", () => applyTheme("system")));

      push(
        await listen("menu:reading-mode", () => {
          ref.current.uiStore.setReadingMode(!ref.current.uiStore.readingMode);
        })
      );

      push(
        await listen("menu:signature", () => ref.current.uiStore.setSignatureDialogOpen(true))
      );
      push(
        await listen("menu:stamp", () => ref.current.uiStore.setStampDialogOpen(true))
      );

      push(
        await listen("menu:about", () => ref.current.uiStore.setAboutOpen(true))
      );
    };

    setup();
    return () => {
      cancelled = true;
      unlistens.forEach((f) => f());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
