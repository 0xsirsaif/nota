import { create } from "zustand";
import { AppSettings, TogglSettings } from "@/types";
import * as tauri from "@/lib/tauri";

interface SettingsState {
  appSettings: AppSettings;
  togglSettings: TogglSettings;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateTogglSettings: (settings: Partial<TogglSettings>) => Promise<void>;
  validateAndConnectToggl: (apiToken: string) => Promise<boolean>;
  disconnectToggl: () => Promise<void>;
}

const defaultAppSettings: AppSettings = {
  theme: "system",
  sidebar_width: 240,
  inspector_width: 260,
  inspector_collapsed: false,
  default_session_duration: 60,
  auto_save_interval: 2000,
};

const defaultTogglSettings: TogglSettings = {
  is_connected: false,
  default_tags: [],
};

function serializeAppSettings(settings: AppSettings): string {
  return JSON.stringify(settings);
}

function deserializeAppSettings(value: string | null): AppSettings {
  if (!value) return defaultAppSettings;
  try {
    return { ...defaultAppSettings, ...JSON.parse(value) };
  } catch {
    return defaultAppSettings;
  }
}

function serializeTogglSettings(settings: TogglSettings): string {
  return JSON.stringify(settings);
}

function deserializeTogglSettings(value: string | null): TogglSettings {
  if (!value) return defaultTogglSettings;
  try {
    return { ...defaultTogglSettings, ...JSON.parse(value) };
  } catch {
    return defaultTogglSettings;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appSettings: defaultAppSettings,
  togglSettings: defaultTogglSettings,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const [appJson, togglJson, togglToken] = await Promise.all([
        tauri.getSetting("app_settings"),
        tauri.getSetting("toggl_settings"),
        tauri.getSetting("toggl_api_token"),
      ]);
      const togglSettings = deserializeTogglSettings(togglJson);
      // Check if token exists in DB (from toggl integration)
      if (togglToken) {
        togglSettings.is_connected = true;
        togglSettings.api_token = togglToken;
      }
      set({
        appSettings: deserializeAppSettings(appJson),
        togglSettings,
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
      set({ isLoading: false });
    }
  },

  updateAppSettings: async (settings) => {
    const newSettings = { ...get().appSettings, ...settings };
    set({ appSettings: newSettings });
    try {
      await tauri.setSetting("app_settings", serializeAppSettings(newSettings));
    } catch (err) {
      console.error("Failed to save app settings:", err);
    }
  },

  updateTogglSettings: async (settings) => {
    const newSettings = { ...get().togglSettings, ...settings };
    set({ togglSettings: newSettings });
    try {
      await tauri.setSetting(
        "toggl_settings",
        serializeTogglSettings(newSettings)
      );
    } catch (err) {
      console.error("Failed to save toggl settings:", err);
    }
  },

  validateAndConnectToggl: async (apiToken) => {
    try {
      const isValid = await tauri.togglValidateToken(apiToken);
      if (isValid) {
        set({
          togglSettings: {
            ...get().togglSettings,
            is_connected: true,
            api_token: apiToken,
          },
        });
      }
      return isValid;
    } catch (err) {
      console.error("Failed to validate Toggl token:", err);
      return false;
    }
  },

  disconnectToggl: async () => {
    try {
      await tauri.togglDisconnect();
      set({
        togglSettings: {
          ...defaultTogglSettings,
          is_connected: false,
        },
      });
    } catch (err) {
      console.error("Failed to disconnect Toggl:", err);
    }
  },
}));
