import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { X } from "lucide-react";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  zIndex?: number;
}

export function Dialog({ isOpen, onClose, title, children, width = 440, zIndex = 1000 }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `dialog-title-${title.replace(/\s+/g, "-")}`;

  useEffect(() => {
    if (!isOpen) return;
    // Focus the dialog on open
    dialogRef.current?.focus();
    // Focus trap
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div style={{ ...overlayStyle, zIndex }} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ ...dialogStyle, width, outline: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={headerStyle}>
          <span id={titleId}>{title}</span>
          <button onClick={onClose} aria-label="閉じる" style={closeBtnStyle}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const cancelBtnStyle: CSSProperties = {
  padding: "6px 14px", fontSize: 12, borderRadius: 4, cursor: "pointer",
  background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)",
};

export const actionBtnStyle: CSSProperties = {
  padding: "6px 14px", fontSize: 12, borderRadius: 4, cursor: "pointer",
  background: "var(--accent)", border: "none", color: "#fff",
};

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const dialogStyle: CSSProperties = {
  background: "var(--bg-secondary)", borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
};
const headerStyle: CSSProperties = {
  background: "var(--bg-toolbar)", padding: "10px 14px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  fontSize: 13, fontWeight: 600, borderBottom: "1px solid var(--border)",
};
const closeBtnStyle: CSSProperties = {
  background: "transparent", border: "none", color: "var(--text-secondary)",
  cursor: "pointer", fontSize: 16, lineHeight: 1,
};
