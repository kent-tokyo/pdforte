import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
}

interface RecentFilesState {
  recentFiles: RecentFile[];
  load: () => Promise<void>;
  add: (path: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

const MAX_RECENT = 10;

export const useRecentFilesStore = create<RecentFilesState>((set, get) => ({
  recentFiles: [],

  load: async () => {
    try {
      const json = await invoke<string>("read_settings");
      const settings = JSON.parse(json) as Record<string, unknown>;
      set({ recentFiles: (settings.recentFiles as RecentFile[] | undefined) ?? [] });
    } catch {
      set({ recentFiles: [] });
    }
  },

  add: async (path: string) => {
    const name = path.split(/[\\/]/).pop() ?? path;
    const { recentFiles } = get();
    const updated: RecentFile[] = [
      { path, name, openedAt: Date.now() },
      ...recentFiles.filter((f) => f.path !== path),
    ].slice(0, MAX_RECENT);
    set({ recentFiles: updated });
    try {
      const json = await invoke<string>("read_settings");
      const settings = JSON.parse(json) as Record<string, unknown>;
      settings.recentFiles = updated;
      await invoke("write_settings", { json: JSON.stringify(settings) });
    } catch (err) {
      console.error("Failed to save recent files:", err);
    }
  },

  remove: async (path: string) => {
    const { recentFiles } = get();
    const updated = recentFiles.filter((f) => f.path !== path);
    set({ recentFiles: updated });
    try {
      const json = await invoke<string>("read_settings");
      const settings = JSON.parse(json) as Record<string, unknown>;
      settings.recentFiles = updated;
      await invoke("write_settings", { json: JSON.stringify(settings) });
    } catch (err) {
      console.error("Failed to save recent files:", err);
    }
  },
}));
