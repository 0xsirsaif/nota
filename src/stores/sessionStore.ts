import { create } from "zustand";
import { Session, CreateSessionInput, UpdateSessionInput } from "@/types";
import * as tauri from "@/lib/tauri";
import { CreateDuplicateInput } from "@/lib/tauri";
import { useTimerStore } from "./timerStore";

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

interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (input: CreateSessionInput) => Promise<Session>;
  updateSession: (id: string, updates: UpdateSessionInput) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createDuplicate: (sourceId: string, input: CreateDuplicateInput) => Promise<Session>;
  setActiveSession: (session: Session | null) => void;
  setSelectedSessionId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSession: null,
  selectedSessionId: null,
  isLoading: false,
  error: null,

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await tauri.getSessions();
      set({ sessions, isLoading: false });
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
    }
  },

  createSession: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const session = await tauri.createSession(input);
      set((state) => ({
        sessions: [session, ...state.sessions],
        isLoading: false,
      }));
      return session;
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  updateSession: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await tauri.updateSession(id, updates);
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
        activeSession:
          state.activeSession?.id === id ? updated : state.activeSession,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.deleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        activeSession:
          state.activeSession?.id === id ? null : state.activeSession,
        selectedSessionId:
          state.selectedSessionId === id ? null : state.selectedSessionId,
        isLoading: false,
      }));
      // Reset timer if it was tracking this session
      const timerSessionId = useTimerStore.getState().sessionId;
      if (timerSessionId === id) {
        useTimerStore.getState().reset();
      }
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  createDuplicate: async (sourceId, input) => {
    set({ isLoading: true, error: null });
    try {
      const session = await tauri.createDuplicateSession(sourceId, input);
      set((state) => ({
        sessions: [session, ...state.sessions],
        selectedSessionId: session.id,
        isLoading: false,
      }));
      return session;
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  setActiveSession: (session) => set({ activeSession: session }),

  setSelectedSessionId: (id) => set({ selectedSessionId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
