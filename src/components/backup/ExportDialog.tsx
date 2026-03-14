import { useEffect, useState } from "react";
import { Download, Folder, FileArchive, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackupStore, formatBytes, generateExportFilename } from "@/stores/backupStore";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const {
    stats,
    exportInProgress,
    exportProgress,
    exportError,
    lastExportResult,
    loadStats,
    exportFullBackup,
    resetExportState,
  } = useBackupStore();

  const [destinationPath, setDestinationPath] = useState("");
  const [filename, setFilename] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Load stats when dialog opens
  useEffect(() => {
    if (open) {
      loadStats();
      setFilename(generateExportFilename());
      setShowSuccess(false);
      resetExportState();
    }
  }, [open, loadStats, resetExportState]);

  // Show success when export completes
  useEffect(() => {
    if (lastExportResult) {
      setShowSuccess(true);
    }
  }, [lastExportResult]);

  const handleChooseDestination = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose export destination",
      });

      if (selected && typeof selected === "string") {
        setDestinationPath(selected);
      }
    } catch (err) {
      console.error("Failed to choose destination:", err);
    }
  };

  const handleExport = async () => {
    if (!destinationPath || !filename) return;

    const fullPath = `${destinationPath}/${filename}`;
    await exportFullBackup(fullPath);
  };

  const handleClose = () => {
    if (!exportInProgress) {
      onOpenChange(false);
      setShowSuccess(false);
      resetExportState();
    }
  };

  const fullPath = destinationPath && filename ? `${destinationPath}/${filename}` : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-muted-foreground" />
            Export Full Backup
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a complete backup of your sessions, notes, and settings.
          </DialogDescription>
        </DialogHeader>

        {showSuccess && lastExportResult ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
              <div>
                <p className="font-medium">Export complete!</p>
                <p className="text-sm text-muted-foreground">
                  {lastExportResult.stats.session_count} sessions backed up
                </p>
              </div>
            </div>

            <div className="bg-muted rounded-md p-3 text-sm space-y-1">
              <p className="text-muted-foreground">File saved to:</p>
              <p className="font-mono text-xs break-all">{lastExportResult.path}</p>
              <p className="text-muted-foreground text-xs pt-1">
                Size: {formatBytes(lastExportResult.stats.total_size_bytes)}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : exportInProgress || exportProgress ? (
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {exportProgress?.phase || "Starting..."}
                </span>
                <span className="font-medium">{exportProgress?.percent || 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${exportProgress?.percent || 0}%` }}
                />
              </div>
            </div>

            {exportProgress?.current_file && (
              <p className="text-xs text-muted-foreground truncate">
                {exportProgress.current_file}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {exportProgress
                ? `${exportProgress.processed} / ${exportProgress.total} files`
                : "Preparing..."}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">{stats?.session_count || 0}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">{stats?.note_file_count || 0}</p>
                <p className="text-xs text-muted-foreground">Notes</p>
              </div>
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">
                  {stats ? formatBytes(stats.total_size_bytes) : "-"}
                </p>
                <p className="text-xs text-muted-foreground">Total Size</p>
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination Folder</label>
              <div className="flex gap-2">
                <Input
                  value={destinationPath}
                  placeholder="Choose a folder..."
                  readOnly
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={handleChooseDestination}>
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filename */}
            <div className="space-y-2">
              <label className="text-sm font-medium">File Name</label>
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="nota-backup.nota"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Full path: {fullPath || "-"}
              </p>
            </div>

            {/* Error */}
            {exportError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={!destinationPath || !filename}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
