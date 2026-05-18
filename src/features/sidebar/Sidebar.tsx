import { useUiStore, type SidebarTab } from "../../store/uiStore";
import { ThumbnailPanel } from "./ThumbnailPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { SearchPanel } from "./SearchPanel";
import { AnnotationsPanel } from "./AnnotationsPanel";

const TABS: { id: SidebarTab; icon: string; label: string }[] = [
  { id: "explorer", icon: "🗂", label: "エクスプローラー" },
  { id: "thumbnails", icon: "⊞", label: "ページ" },
  { id: "bookmarks", icon: "≡", label: "目次" },
  { id: "search", icon: "🔍", label: "検索" },
  { id: "annotations", icon: "📝", label: "注釈" },
];

export function Sidebar() {
  const { sidebarOpen, sidebarTab, setSidebarTab, sidebarWidth } = useUiStore();

  if (!sidebarOpen) return null;

  return (
    <div style={{
      width: sidebarWidth,
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            title={tab.label}
            style={{
              flex: 1,
              height: 44,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              background: sidebarTab === tab.id ? "var(--bg-primary)" : "transparent",
              color: sidebarTab === tab.id ? "var(--accent)" : "var(--text-muted)",
              borderBottom: sidebarTab === tab.id ? `2px solid var(--accent)` : "2px solid transparent",
              cursor: "pointer",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: sidebarTab === tab.id ? "var(--accent)" : "transparent",
              padding: 0,
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            <span style={{ fontSize: 9, letterSpacing: "0.02em" }}>{tab.label.length > 4 ? tab.label.slice(0, 4) : tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {sidebarTab === "explorer" && <ExplorerPanel />}
        {sidebarTab === "thumbnails" && <ThumbnailPanel />}
        {sidebarTab === "bookmarks" && <BookmarkPanel />}
        {sidebarTab === "search" && <SearchPanel />}
        {sidebarTab === "annotations" && <AnnotationsPanel />}
      </div>
    </div>
  );
}
