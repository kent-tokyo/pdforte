import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useUiStore } from "../store/uiStore";

export function ContextMenu() {
  const { contextMenu, setContextMenu } = useUiStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setContextMenu(null);
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  // Adjust position to stay within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 160;
  const menuH = contextMenu.items.length * 32 + 8;
  const x = Math.min(contextMenu.x, vw - menuW - 4);
  const y = Math.min(contextMenu.y, vh - menuH - 4);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: menuW,
        background: "var(--bg-toolbar)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        zIndex: 9999,
        padding: "4px 0",
        userSelect: "none",
      }}
    >
      {contextMenu.items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onClick={() => { item.action(); setContextMenu(null); }}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "6px 14px",
            background: "transparent",
            border: "none",
            cursor: item.disabled ? "default" : "pointer",
            fontSize: 13,
            color: item.danger ? "#e74c3c" : item.disabled ? "var(--text-muted)" : "var(--text-primary)",
          }}
          onMouseEnter={(e) => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
