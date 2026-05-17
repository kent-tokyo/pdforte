import { useEffect, useState, useCallback } from "react";
import { usePdfStore } from "../../store/pdfStore";

type PDFOutlineItem = {
  title: string;
  bold?: boolean;
  italic?: boolean;
  dest?: string | unknown[] | null;
  items?: PDFOutlineItem[];
};

interface OutlineItem {
  title: string;
  pageIndex: number;
  items: OutlineItem[];
  bold: boolean;
  italic: boolean;
}

function BookmarkItem({
  item,
  depth,
  currentPage,
  onNavigate,
}: {
  item: OutlineItem;
  depth: number;
  currentPage: number;
  onNavigate: (pageIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = item.pageIndex + 1 === currentPage;
  const hasChildren = item.items.length > 0;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  }, []);

  return (
    <div>
      <div
        onClick={() => onNavigate(item.pageIndex)}
        style={{
          paddingLeft: 8 + depth * 14,
          paddingTop: 4,
          paddingBottom: 4,
          paddingRight: 8,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: item.bold ? "bold" : "normal",
          fontStyle: item.italic ? "italic" : "normal",
          color: isActive ? "var(--accent)" : "var(--text-primary)",
          background: isActive ? "var(--accent)18" : "transparent",
          display: "flex",
          alignItems: "center",
          gap: 4,
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isActive ? "var(--accent)18" : "transparent";
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <span
            onClick={toggle}
            style={{
              fontSize: 9, width: 14, textAlign: "center", flexShrink: 0,
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            {expanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        <span
          style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}
          title={`${item.title} (p.${item.pageIndex + 1})`}
        >
          {item.title}
        </span>

        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, marginLeft: 4 }}>
          {item.pageIndex + 1}
        </span>
      </div>

      {hasChildren && expanded && (
        <div>
          {item.items.map((child, i) => (
            <BookmarkItem
              key={i}
              item={child}
              depth={depth + 1}
              currentPage={currentPage}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BookmarkPanel() {
  const { pdfDoc, currentPage, setCurrentPage } = usePdfStore();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfDoc) { setOutline([]); return; }
    const load = async () => {
      setLoading(true);
      try {
        const raw = await pdfDoc.getOutline();
        if (!raw) { setOutline([]); return; }

        const resolve = async (items: PDFOutlineItem[]): Promise<OutlineItem[]> => {
          const result: OutlineItem[] = [];
          for (const item of items) {
            let pageIndex = 0;
            try {
              if (item.dest) {
                const dest = typeof item.dest === "string"
                  ? await pdfDoc.getDestination(item.dest)
                  : item.dest as unknown[];
                if (dest) {
                  const pageRef = dest[0];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  pageIndex = await pdfDoc.getPageIndex(pageRef as any);
                }
              }
            } catch { /* dest resolution can fail for some PDFs */ }
            result.push({
              title: item.title ?? "(無題)",
              pageIndex,
              bold: item.bold ?? false,
              italic: item.italic ?? false,
              items: item.items ? await resolve(item.items as PDFOutlineItem[]) : [],
            });
          }
          return result;
        };

        setOutline(await resolve(raw as PDFOutlineItem[]));
      } catch {
        setOutline([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pdfDoc]);

  const navigate = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex + 1);
  }, [setCurrentPage]);

  if (!pdfDoc) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>PDFを開いてください</div>;
  }
  if (loading) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>読み込み中...</div>;
  }
  if (outline.length === 0) {
    return <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>目次がありません</div>;
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", paddingBottom: 8 }}>
      {outline.map((item, i) => (
        <BookmarkItem
          key={i}
          item={item}
          depth={0}
          currentPage={currentPage}
          onNavigate={navigate}
        />
      ))}
    </div>
  );
}
