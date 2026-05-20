import { type ReactNode } from "react";
import { FolderOpen, LayoutGrid, BookOpen, Search, MessageSquare } from "lucide-react";
import { useUiStore, type SidebarTab } from "../../store/uiStore";
import { ThumbnailPanel } from "./ThumbnailPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { SearchPanel } from "./SearchPanel";
import { AnnotationsPanel } from "./AnnotationsPanel";

const TABS: { id: SidebarTab; icon: ReactNode; label: string }[] = [
  { id: "explorer",    icon: <FolderOpen size={16} />,  label: "エクスプローラー" },
  { id: "thumbnails",  icon: <LayoutGrid size={16} />,  label: "ページ" },
  { id: "bookmarks",   icon: <BookOpen size={16} />,    label: "目次" },
  { id: "search",      icon: <Search size={16} />,      label: "検索" },
  { id: "annotations", icon: <MessageSquare size={16} />, label: "注釈" },
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
            <span style={{ display: "flex" }}>{tab.icon}</span>
            <span style={{ fontSize: 11, letterSpacing: "0.02em" }}>{tab.label.length > 4 ? tab.label.slice(0, 4) : tab.label}</span>
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
