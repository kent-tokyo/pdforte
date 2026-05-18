import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toolbar } from "./features/toolbar/Toolbar";
import { Sidebar } from "./features/sidebar/Sidebar";
import { PdfViewer } from "./features/pdf-viewer/PdfViewer";
import { SignatureDialog } from "./features/signature/SignatureDialog";
import { StampDialog } from "./features/signature/StampDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { SplitPdfDialog } from "./features/pdf-tools/SplitPdfDialog";
import { PageOrderDialog } from "./features/pdf-tools/PageOrderDialog";
import { MergePdfDialog } from "./features/pdf-tools/MergePdfDialog";
import { RotatePagesDialog } from "./features/pdf-tools/RotatePagesDialog";
import { ExportImagesDialog } from "./features/pdf-tools/ExportImagesDialog";
import { ConvertDialog } from "./features/pdf-tools/ConvertDialog";
import { OcrDialog } from "./features/pdf-tools/OcrDialog";
import { ProtectPdfDialog } from "./features/pdf-tools/ProtectPdfDialog";
import { TranslateDialog } from "./features/pdf-tools/TranslateDialog";
import { PrintDialog } from "./features/pdf-tools/PrintDialog";
import { ScannerDialog } from "./features/pdf-tools/ScannerDialog";
import { SanitizeDialog } from "./features/pdf-tools/SanitizeDialog";
import { MetadataDialog } from "./features/pdf-tools/MetadataDialog";
import { SignatureVerifyDialog } from "./features/pdf-tools/SignatureVerifyDialog";
import { CreatePdfDialog } from "./features/pdf-tools/CreatePdfDialog";
import { ExtractPagesDialog } from "./features/pdf-tools/ExtractPagesDialog";
import { WatermarkDialog } from "./features/pdf-tools/WatermarkDialog";
import { PageNumbersDialog } from "./features/pdf-tools/PageNumbersDialog";
import { CompressDialog } from "./features/pdf-tools/CompressDialog";
import { FlattenDialog } from "./features/pdf-tools/FlattenDialog";
import { UnlockPdfDialog } from "./features/pdf-tools/UnlockPdfDialog";
import { PasswordDialog } from "./features/pdf-viewer/PasswordDialog";
import { AboutDialog } from "./features/pdf-tools/AboutDialog";
import { usePdfStore } from "./store/pdfStore";
import { useAnnotationStore } from "./store/annotationStore";
import { useUiStore } from "./store/uiStore";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useFileDrop } from "./hooks/useFileDrop";
import { useRecentFilesStore } from "./store/recentFilesStore";

function StatusBar() {
  const { currentPage, numPages, filePath, isDirty } = usePdfStore();
  const { t } = useTranslation();
  return (
    <div style={{
      height: "var(--statusbar-height)",
      background: "var(--accent)",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 16,
      fontSize: 11,
      color: "#fff",
      flexShrink: 0,
    }}>
      {numPages > 0 && (
        <span>{t("statusbar.page", { current: currentPage, total: numPages })}</span>
      )}
      {filePath && (
        <span style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isDirty ? "● " : ""}{filePath.split("/").pop() || filePath.split("\\").pop()}
        </span>
      )}
    </div>
  );
}

export default function App() {
  const { undo, redo } = useAnnotationStore();
  const { filePath } = usePdfStore();
  const { readingMode, setReadingMode } = useUiStore();
  const { load: loadRecentFiles, add: addRecentFile } = useRecentFilesStore();
  useMenuEvents();
  useFileDrop();

  useEffect(() => { loadRecentFiles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filePath) addRecentFile(filePath);
  }, [filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setReadingMode(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setReadingMode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {!readingMode && <Toolbar />}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!readingMode && <Sidebar />}
        <PdfViewer />
      </div>
      <StatusBar />
      <SignatureDialog />
      <StampDialog />
      <SettingsDialog />
      <SplitPdfDialog />
      <PageOrderDialog />
      <MergePdfDialog />
      <RotatePagesDialog />
      <ExportImagesDialog />
      <ConvertDialog />
      <OcrDialog />
      <ProtectPdfDialog />
      <TranslateDialog />
      <PrintDialog />
      <ScannerDialog />
      <SanitizeDialog />
      <MetadataDialog />
      <SignatureVerifyDialog />
      <CreatePdfDialog />
      <ExtractPagesDialog />
      <WatermarkDialog />
      <PageNumbersDialog />
      <CompressDialog />
      <FlattenDialog />
      <UnlockPdfDialog />
      <PasswordDialog />
      <AboutDialog />
    </div>
  );
}
