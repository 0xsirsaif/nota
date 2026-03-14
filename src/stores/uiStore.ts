import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorCollapsed: boolean;
  focusMode: boolean;
  createModalOpen: boolean;
  settingsModalOpen: boolean;
  searchOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setInspectorCollapsed: (collapsed: boolean) => void;
  toggleFocusMode: () => void;
  setFocusMode: (active: boolean) => void;
  setCreateModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      inspectorOpen: true,
      inspectorCollapsed: false,
      focusMode: false,
      createModalOpen: false,
      settingsModalOpen: false,
      searchOpen: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleInspector: () =>
        set((state) => ({ inspectorOpen: !state.inspectorOpen })),

      setInspectorCollapsed: (collapsed) =>
        set({ inspectorCollapsed: collapsed }),

      toggleFocusMode: () =>
        set((state) => ({ focusMode: !state.focusMode })),

      setFocusMode: (active) => set({ focusMode: active }),

      setCreateModalOpen: (open) => set({ createModalOpen: open }),

      setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

      setSearchOpen: (open) => set({ searchOpen: open }),
    }),
    {
      name: "nota-ui-state",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        inspectorOpen: state.inspectorOpen,
        inspectorCollapsed: state.inspectorCollapsed,
      }),
    }
  )
);
