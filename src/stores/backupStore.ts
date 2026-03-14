import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface ExportStats {
  session_count: number;
  note_file_count: number;
  attachment_count: number;
  total_size_bytes: number;
}

export interface ExportProgress {
  operation_id: string;
  percent: number;
  current_file: string;
  processed: number;
  total: number;
  phase: string;
}

export interface ExportResult {
  path: string;
  stats: ExportStats;
}

export interface ImportValidation {
  valid: boolean;
  manifest: ExportManifest | null;
  errors: string[];
  warnings: string[];
}

export interface ExportManifest {
  version: string;
  nota_version: string;
  exported_at: string;
  export_type: string;
  stats: ExportStats;
}

export interface SessionConflict {
  session_id: string;
  title: string;
  local_modified: string;
  backup_modified: string;
}

export interface BackupSessionSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export interface ImportPreview {
  manifest: ExportManifest;
  backup_stats: ExportStats;
  conflicts: SessionConflict[];
  new_sessions: BackupSessionSummary[];
}

export type ConflictStrategy = "skip_existing" | "replace" | "keep_both";

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  replaced_count: number;
  renamed_count: number;
}

export interface ImportProgress {
  operation_id: string;
  percent: number;
  current_file: string;
  processed: number;
  total: number;
  phase: string;
}

interface BackupState {
  // Stats
  stats: ExportStats | null;
  isLoadingStats: boolean;

  // Export state
  exportInProgress: boolean;
  exportProgress: ExportProgress | null;
  exportError: string | null;
  lastExportResult: ExportResult | null;

  // Import state
  importInProgress: boolean;
  importProgress: ImportProgress | null;
  importError: string | null;
  lastImportResult: ImportResult | null;

  // Actions
  loadStats: () => Promise<void>;
  exportFullBackup: (destinationPath: string) => Promise<ExportResult | null>;
  validateExportPath: (path: string) => Promise<boolean>;
  cancelExport: () => void;
  resetExportState: () => void;
  // Import actions
  validateImport: (path: string) => Promise<ImportValidation>;
  getImportPreview: (path: string) => Promise<ImportPreview>;
  importBackup: (path: string, strategy: ConflictStrategy) => Promise<ImportResult | null>;
  resetImportState: () => void;
}

let exportProgressUnlisten: UnlistenFn | null = null;
let importProgressUnlisten: UnlistenFn | null = null;

export const useBackupStore = create<BackupState>((set) => ({
  stats: null,
  isLoadingStats: false,
  exportInProgress: false,
  exportProgress: null,
  exportError: null,
  lastExportResult: null,
  importInProgress: false,
  importProgress: null,
  importError: null,
  lastImportResult: null,

  loadStats: async () => {
    set({ isLoadingStats: true });
    try {
      const stats = await invoke<ExportStats>("get_export_stats");
      set({ stats, isLoadingStats: false });
    } catch (err) {
      console.error("Failed to load export stats:", err);
      set({ isLoadingStats: false });
    }
  },

  exportFullBackup: async (destinationPath: string) => {
    set({
      exportInProgress: true,
      exportProgress: null,
      exportError: null,
      lastExportResult: null,
    });

    // Set up progress listener
    if (exportProgressUnlisten) {
      exportProgressUnlisten();
    }

    exportProgressUnlisten = await listen<ExportProgress>(
      "export-progress",
      (event) => {
        set({ exportProgress: event.payload });
      }
    );

    try {
      const result = await invoke<ExportResult>("export_full_backup", {
        destinationPath,
      });

      set({
        exportInProgress: false,
        lastExportResult: result,
        exportProgress: null,
      });

      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      set({
        exportInProgress: false,
        exportError: errorMessage,
        exportProgress: null,
      });
      return null;
    } finally {
      if (exportProgressUnlisten) {
        exportProgressUnlisten();
        exportProgressUnlisten = null;
      }
    }
  },

  validateExportPath: async (path: string) => {
    try {
      return await invoke<boolean>("validate_export_path", { path });
    } catch {
      return false;
    }
  },

  cancelExport: () => {
    if (exportProgressUnlisten) {
      exportProgressUnlisten();
      exportProgressUnlisten = null;
    }
    set({
      exportInProgress: false,
      exportProgress: null,
    });
  },

  resetExportState: () => {
    set({
      exportInProgress: false,
      exportProgress: null,
      exportError: null,
      lastExportResult: null,
    });
  },

  // Import actions
  validateImport: async (path: string) => {
    try {
      const result = await invoke<ImportValidation>("validate_import_file", { path });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        manifest: null,
        errors: [errorMessage],
        warnings: [],
      };
    }
  },

  getImportPreview: async (path: string) => {
    const result = await invoke<ImportPreview>("get_import_preview", { path });
    return result;
  },

  importBackup: async (path: string, strategy: ConflictStrategy) => {
    set({
      importInProgress: true,
      importProgress: null,
      importError: null,
      lastImportResult: null,
    });

    // Set up progress listener
    if (importProgressUnlisten) {
      importProgressUnlisten();
    }

    importProgressUnlisten = await listen<ImportProgress>(
      "import-progress",
      (event) => {
        set({ importProgress: event.payload });
      }
    );

    try {
      const result = await invoke<ImportResult>("import_backup", {
        path,
        conflictStrategy: strategy,
      });

      set({
        importInProgress: false,
        lastImportResult: result,
        importProgress: null,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      set({
        importInProgress: false,
        importError: errorMessage,
        importProgress: null,
      });
      return null;
    } finally {
      if (importProgressUnlisten) {
        importProgressUnlisten();
        importProgressUnlisten = null;
      }
    }
  },

  resetImportState: () => {
    set({
      importInProgress: false,
      importProgress: null,
      importError: null,
      lastImportResult: null,
    });
  },
}));

// Helper to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Helper to generate default export filename
export function generateExportFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  return `nota-backup-${dateStr}.nota`;
}
