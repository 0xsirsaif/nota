import { create } from "zustand";
import { Attachment, CreateAttachmentInput } from "@/types";
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

interface AttachmentState {
  attachments: Attachment[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAttachments: (sessionId: string) => Promise<void>;
  addAttachment: (input: CreateAttachmentInput) => Promise<Attachment>;
  deleteAttachment: (id: string) => Promise<void>;
  openAttachment: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useAttachmentStore = create<AttachmentState>((set) => ({
  attachments: [],
  isLoading: false,
  error: null,

  loadAttachments: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const attachments = await tauri.getAttachments(sessionId);
      set({ attachments, isLoading: false });
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
    }
  },

  addAttachment: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const attachment = await tauri.addAttachment(input);
      set((state) => ({
        attachments: [attachment, ...state.attachments],
        isLoading: false,
      }));
      return attachment;
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  deleteAttachment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.deleteAttachment(id);
      set((state) => ({
        attachments: state.attachments.filter((a) => a.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: errorToString(err), isLoading: false });
      throw err;
    }
  },

  openAttachment: async (id) => {
    try {
      await tauri.openAttachment(id);
    } catch (err) {
      set({ error: errorToString(err) });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
