import { create } from "zustand";
import * as tauri from "@/lib/tauri";

// Helper to convert error to string
const errorToString = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const msg = (err as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
    return JSON.stringify(err);
  }
  return String(err);
};

interface TogglWorkspace {
  id: number;
  name: string;
}

interface TogglProject {
  id: number;
  name: string;
  workspace_id: number;
}

interface TogglState {
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  workspaces: TogglWorkspace[];
  projects: TogglProject[];
  selectedWorkspaceId: number | null;
  selectedProjectId: number | null;

  // Actions
  validateToken: (apiToken: string) => Promise<boolean>;
  loadWorkspaces: () => Promise<void>;
  loadProjects: (workspaceId: number) => Promise<void>;
  syncSession: (
    sessionId: string,
    title: string,
    startedAt: string,
    durationSeconds: number
  ) => Promise<void>;
  disconnect: () => Promise<void>;
  setSelectedWorkspace: (id: number | null) => void;
  setSelectedProject: (id: number | null) => void;
  clearError: () => void;
}

export const useTogglStore = create<TogglState>((set, get) => ({
  isConfigured: false,
  isLoading: false,
  error: null,
  workspaces: [],
  projects: [],
  selectedWorkspaceId: null,
  selectedProjectId: null,

  validateToken: async (apiToken) => {
    set({ isLoading: true, error: null });
    try {
      const isValid = await tauri.togglValidateToken(apiToken);
      set({ isConfigured: isValid, isLoading: false });
      if (isValid) {
        // Load workspaces after successful validation
        get().loadWorkspaces();
      }
      return isValid;
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      return false;
    }
  },

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await tauri.togglGetWorkspaces();
      set({ workspaces, isLoading: false });
      if (workspaces.length > 0 && !get().selectedWorkspaceId) {
        set({ selectedWorkspaceId: workspaces[0].id });
        get().loadProjects(workspaces[0].id);
      }
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
    }
  },

  loadProjects: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const projects = await tauri.togglGetProjects(workspaceId);
      set({ projects, isLoading: false });
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
    }
  },

  syncSession: async (sessionId, title, startedAt, durationSeconds) => {
    const { selectedWorkspaceId, selectedProjectId } = get();

    if (!selectedWorkspaceId) {
      set({ error: "Please select a Toggl workspace first" });
      throw new Error("No workspace selected");
    }

    set({ isLoading: true, error: null });
    try {
      await tauri.togglCreateTimeEntry(
        sessionId,
        selectedWorkspaceId,
        selectedProjectId,
        title,
        startedAt,
        durationSeconds
      );
      set({ isLoading: false });
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  disconnect: async () => {
    set({ isLoading: true, error: null });
    try {
      await tauri.togglDisconnect();
      set({
        isConfigured: false,
        workspaces: [],
        projects: [],
        selectedWorkspaceId: null,
        selectedProjectId: null,
        isLoading: false,
      });
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
    }
  },

  setSelectedWorkspace: (id) => {
    set({ selectedWorkspaceId: id, selectedProjectId: null });
    if (id) {
      get().loadProjects(id);
    }
  },

  setSelectedProject: (id) => {
    set({ selectedProjectId: id });
  },

  clearError: () => set({ error: null }),
}));
