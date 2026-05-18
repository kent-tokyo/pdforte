import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePdfjs } from "./usePdfjs";
import { useUiStore } from "../../store/uiStore";
import { useAnnotationStore } from "../../store/annotationStore";
import { useRecentFilesStore, type RecentFile } from "../../store/recentFilesStore";

type ToolAction = "annotate" | "signature" | "edit" | "tools";

const TOOL_CARDS: { icon: string; title: string; desc: string; color: string; action: ToolAction }[] = [
  {
    icon: "🖊",
    title: "注釈を追加",
    desc: "ハイライト、テキストボックス、下線などの注釈を追加",
    color: "#e8a020",
    action: "annotate",
  },
  {
    icon: "✍",
    title: "入力と署名",
    desc: "フォームに入力、署名を追加",
    color: "#9b59b6",
    action: "signature",
  },
  {
    icon: "✏",
    title: "PDFを編集",
    desc: "テキスト、画像、ページなどを変更または追加",
    color: "#e74c3c",
    action: "edit",
  },
  {
    icon: "⚙",
    title: "PDFツール",
    desc: "結合・分割・圧縮・変換など",
    color: "#27ae60",
    action: "tools",
  },
];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(ts).toLocaleDateString("ja-JP");
}

export function HomeScreen() {
  const { loadFromBytes } = usePdfjs();
  const { recentFiles, remove } = useRecentFilesStore();
  const { setSidebarOpen, setSidebarTab } = useUiStore();
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  const { setActiveTool } = useAnnotationStore();

  const applyToolAction = useCallback((action: ToolAction) => {
    switch (action) {
      case "annotate":
        setSidebarOpen(true);
        setSidebarTab("annotations");
        setActiveTool("highlight");
        break;
      case "signature":
        setDialogOpen("signature");
        break;
      case "edit":
        setActiveTool("select");
        break;
      case "tools":
        setSidebarOpen(true);
        setSidebarTab("thumbnails");
        break;
    }
  }, [setSidebarOpen, setSidebarTab, setActiveTool, setDialogOpen]);

  const openFileDialog = useCallback(async () => {
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
  }, [loadFromBytes]);

  const openRecentFile = useCallback(async (file: RecentFile) => {
    try {
      const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>(
        "open_pdf", { path: file.path }
      );
      await loadFromBytes(new Uint8Array(result.bytes), result.file_path);
    } catch (err) {
      console.error("Recent file open failed:", err);
      remove(file.path);
    }
  }, [loadFromBytes, remove]);

  const handleToolClick = useCallback(async (action: ToolAction) => {
    try {
      const path = await invoke<string | null>("open_file_dialog");
      if (!path) return;
      const result = await invoke<{ bytes: number[]; sidecar: string | null; file_path: string }>(
        "open_pdf", { path }
      );
      await loadFromBytes(new Uint8Array(result.bytes), result.file_path);
      applyToolAction(action);
    } catch (err) {
      console.error("Open failed:", err);
    }
  }, [loadFromBytes, applyToolAction]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflowY: "auto",
      background: "var(--bg-viewer)",
      padding: "32px 40px",
      gap: 32,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
            すべてのツール
          </h2>
        </div>
        <button
          onClick={openFileDialog}
          style={{
            padding: "10px 24px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          📂 ファイルを開く
        </button>
      </div>

      {/* Tool cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}>
        {TOOL_CARDS.map((card) => (
          <div
            key={card.title}
            onClick={() => handleToolClick(card.action)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "20px 16px",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = card.color;
              (e.currentTarget as HTMLDivElement).style.background = "var(--bg-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLDivElement).style.background = "var(--bg-secondary)";
            }}
          >
            <div style={{ fontSize: 28 }}>{card.icon}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {card.desc}
              </div>
            </div>
            <div style={{ fontSize: 12, color: card.color, marginTop: "auto", fontWeight: 500 }}>
              今すぐ使用
            </div>
          </div>
        ))}
      </div>

      {/* Drop hint */}
      <div style={{
        border: "2px dashed var(--border)",
        borderRadius: 8,
        padding: "24px",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}>
        📄 PDFファイルをここにドロップしても開けます
      </div>

      {/* Recent files */}
      {recentFiles.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            最近使ったファイル
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={thStyle}>名前</th>
                <th style={{ ...thStyle, width: 130, textAlign: "right" }}>閲覧日時</th>
                <th style={{ ...thStyle, width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {recentFiles.map((file) => (
                <tr
                  key={file.path}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => openRecentFile(file)}
                >
                  <td style={{ padding: "10px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 32, height: 38,
                      background: "#e74c3c",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "#fff",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>PDF</span>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {file.path}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                    {formatRelativeTime(file.openedAt)}
                  </td>
                  <td style={{ padding: "10px 4px", textAlign: "center" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(file.path); }}
                      title="一覧から削除"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: 4,
                        borderRadius: 4,
                        opacity: 0.6,
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 11,
  color: "var(--text-muted)",
  textAlign: "left",
  fontWeight: 500,
};
