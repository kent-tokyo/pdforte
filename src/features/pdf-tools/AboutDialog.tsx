import { useUiStore } from "../../store/uiStore";
import { Dialog } from "../../components/Dialog";

export function AboutDialog() {
  const isOpen = useUiStore(s => s.openDialog === "about");
  const setDialogOpen = useUiStore(s => s.setDialogOpen);
  return (
    <Dialog isOpen={isOpen} onClose={() => setDialogOpen(null)} title="pdforte について" width={360}>
      <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 40 }}>📄</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>pdforte</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>v0.1.0</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
          Tauri v2 + React + PDF.js で構築された軽量・高速な PDF エディタ。
        </p>
        <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div>ライセンス: Apache 2.0</div>
          <div style={{ marginTop: 4 }}>
            <a
              href="https://github.com/kent-tokyo/pdforte"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              github.com/kent-tokyo/pdforte
            </a>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setDialogOpen(null)}
            style={{ padding: "6px 20px", fontSize: 12, borderRadius: 4, cursor: "pointer", background: "var(--accent)", border: "none", color: "#fff" }}
          >
            閉じる
          </button>
        </div>
      </div>
    </Dialog>
  );
}
