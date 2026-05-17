import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { usePdfjs } from "../pdf-viewer/usePdfjs";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_pdf: boolean;
}

export function ExplorerPanel() {
  const { explorerPath, setExplorerPath } = useUiStore();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const { loadFromBytes } = usePdfjs();

  const loadDir = useCallback(async (path: string) => {
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path });
      setEntries(result);
      setExplorerPath(path);
    } catch (err) {
      console.error("Directory load failed:", err);
    }
  }, [setExplorerPath]);

  const openFolder = useCallback(async () => {
    try {
      const path = await invoke<string | null>("open_folder_dialog");
      if (!path) return;
      setHistory((h) => [...h, path]);
      await loadDir(path);
    } catch {}
  }, [loadDir]);

  const handleEntry = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      setHistory((h) => (explorerPath ? [...h, explorerPath] : h));
      await loadDir(entry.path);
    } else if (entry.is_pdf) {
      try {
        const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>("open_pdf", { path: entry.path });
        await loadFromBytes(new Uint8Array(result.bytes), result.file_path);
      } catch (err) {
        console.error("Open PDF failed:", err);
      }
    }
  }, [explorerPath, loadDir, loadFromBytes]);

  const goUp = useCallback(async () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      await loadDir(prev);
    }
  }, [history, loadDir]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 8px", display: "flex", gap: 4, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button onClick={openFolder} title="フォルダを開く" style={{ fontSize: 12, padding: "2px 8px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
          フォルダを開く
        </button>
        {history.length > 0 && (
          <button onClick={goUp} title="上の階層へ" style={{ fontSize: 12, padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer" }}>
            ↑
          </button>
        )}
      </div>
      {explorerPath && (
        <div style={{ padding: "2px 8px", fontSize: 10, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {explorerPath}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!explorerPath ? (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>フォルダを開いてください</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              onClick={() => handleEntry(entry)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 12px", cursor: "pointer", fontSize: 12,
                color: entry.is_pdf ? "var(--accent)" : "var(--text-primary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>{entry.is_dir ? "📁" : entry.is_pdf ? "📄" : "📃"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.name}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
