import { create } from "zustand";

interface EditorState {
  // Map of file paths to save functions
  editors: Map<string, () => Promise<void>>;

  // Actions
  registerEditor: (path: string, saveFn: () => Promise<void>) => void;
  unregisterEditor: (path: string) => void;
  saveEditor: (path: string) => Promise<void>;
  saveAllEditors: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editors: new Map(),

  registerEditor: (path, saveFn) => {
    set((state) => {
      const newEditors = new Map(state.editors);
      newEditors.set(path, saveFn);
      return { editors: newEditors };
    });
  },

  unregisterEditor: (path) => {
    set((state) => {
      const newEditors = new Map(state.editors);
      newEditors.delete(path);
      return { editors: newEditors };
    });
  },

  saveEditor: async (path) => {
    const saveFn = get().editors.get(path);
    if (saveFn) {
      await saveFn();
    }
  },

  saveAllEditors: async () => {
    const promises = Array.from(get().editors.values()).map((saveFn) =>
      saveFn().catch((err) => console.error("Failed to save editor:", err))
    );
    await Promise.all(promises);
  },
}));
