import type { ReactNode, CSSProperties } from "react";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  zIndex?: number;
}

export function Dialog({ isOpen, onClose, title, children, width = 440, zIndex = 1000 }: DialogProps) {
  if (!isOpen) return null;
  return (
    <div style={{ ...overlayStyle, zIndex }} onClick={onClose}>
      <div style={{ ...dialogStyle, width }} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>{title}</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
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
