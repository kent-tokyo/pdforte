import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../../store/uiStore";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import i18n from "../../i18n";
import { useTranslation } from "react-i18next";

interface Settings {
  language?: string;
  theme?: "dark" | "light";
  translationEngine?: "deepl" | "openai" | "claude";
  translationApiKey?: string;
  defaultZoom?: number;
}

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useUiStore();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>({});
  const [settingsPath, setSettingsPath] = useState("");

  useEffect(() => {
    if (!settingsOpen) return;
    const load = async () => {
      try {
        const json = await invoke<string>("read_settings");
        setSettings(JSON.parse(json));
        const path = await invoke<string>("get_settings_path");
        setSettingsPath(path);
      } catch {}
    };
    load();
  }, [settingsOpen]);

  const save = useCallback(async (next: Settings) => {
    setSettings(next);
    try {
      await invoke("write_settings", { json: JSON.stringify(next, null, 2) });
    } catch {}
  }, []);

  const handleLanguageChange = useCallback((lang: string) => {
    i18n.changeLanguage(lang);
    save({ ...settings, language: lang });
  }, [settings, save]);

  const handleThemeChange = useCallback((theme: "dark" | "light") => {
    document.documentElement.setAttribute("data-theme", theme);
    save({ ...settings, theme });
  }, [settings, save]);

  if (!settingsOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg-secondary)", borderRadius: 8, padding: 24,
        width: 480, maxHeight: "80vh", overflowY: "auto", boxShadow: "var(--shadow-md)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 16 }}>{t("settings.title")}</h2>
          <button onClick={() => setSettingsOpen(false)} style={{ fontSize: 18, color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Language */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("settings.language")}</label>
          <select
            value={settings.language || i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={selectStyle}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("settings.theme")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["dark", "light"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                style={{
                  padding: "6px 16px", borderRadius: 4,
                  background: settings.theme === theme ? "var(--accent)" : "var(--bg-tertiary)",
                  color: settings.theme === theme ? "#fff" : "var(--text-primary)",
                  border: "none", cursor: "pointer",
                }}
              >
                {t(`settings.theme_${theme}`)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Translation */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("settings.translation")}</label>
          <select
            value={settings.translationEngine || "deepl"}
            onChange={(e) => save({ ...settings, translationEngine: e.target.value as Settings["translationEngine"] })}
            style={{ ...selectStyle, marginBottom: 8 }}
          >
            <option value="deepl">DeepL</option>
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
          </select>
          <input
            type="password"
            placeholder={t("settings.apiKey")}
            value={settings.translationApiKey || ""}
            onChange={(e) => save({ ...settings, translationApiKey: e.target.value })}
            style={{ ...selectStyle, fontFamily: "monospace" }}
          />
        </div>

        {/* Settings file path */}
        {settingsPath && (
          <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
            {settingsPath}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 20 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 };
const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, fontSize: 13 };
