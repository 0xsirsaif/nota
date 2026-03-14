import { useEffect, useState } from "react";
import { Upload, FileArchive, AlertCircle, CheckCircle2, ArrowLeft, FileX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBackupStore } from "@/stores/backupStore";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { ImportValidation, ImportPreview, ConflictStrategy } from "@/stores/backupStore";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = "select" | "validate" | "preview" | "progress" | "success" | "error";

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const {
    importInProgress,
    importProgress,
    importError,
    lastImportResult,
    validateImport,
    getImportPreview,
    importBackup,
    resetImportState,
  } = useBackupStore();

  const [step, setStep] = useState<ImportStep>("select");
  const [selectedFile, setSelectedFile] = useState("");
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("skip_existing");

  useEffect(() => {
    if (open) {
      resetImportState();
      setStep("select");
      setSelectedFile("");
      setValidation(null);
      setPreview(null);
      setConflictStrategy("skip_existing");
    }
  }, [open, resetImportState]);

  useEffect(() => {
    if (lastImportResult && step === "progress" && !importInProgress) {
      setStep("success");
    }
  }, [lastImportResult, importInProgress, step]);

  useEffect(() => {
    if (importError && step === "progress") {
      setStep("error");
    }
  }, [importError, step]);

  const handleSelectFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        title: "Select backup file",
        filters: [
          { name: "Nota Backup", extensions: ["nota"] },
          { name: "ZIP Archive", extensions: ["zip"] },
        ],
      });

      if (selected && typeof selected === "string") {
        setSelectedFile(selected);
        setStep("validate");

        const result = await validateImport(selected);
        setValidation(result);

        if (result.valid) {
          const previewResult = await getImportPreview(selected);
          setPreview(previewResult);
          setStep("preview");
        } else {
          setStep("error");
        }
      }
    } catch (err) {
      console.error("Failed to select file:", err);
      setStep("error");
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setStep("progress");
    await importBackup(selectedFile, conflictStrategy);
  };

  const handleClose = () => {
    if (!importInProgress) {
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setStep("select");
    setSelectedFile("");
    setValidation(null);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-muted-foreground" />
            Import Backup
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Restore your data from a .nota backup file.
          </DialogDescription>
        </DialogHeader>

        {/* Select File Step */}
        {step === "select" && (
          <div className="p-5 space-y-4">
            <div
              onClick={handleSelectFile}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <FileArchive className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Click to select a backup file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .nota and .zip files
              </p>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>What gets imported:</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>All sessions and their metadata</li>
                <li>Notes and reflections (markdown files)</li>
                <li>File attachments</li>
                <li>App settings</li>
              </ul>
            </div>
          </div>
        )}

        {/* Validating Step */}
        {step === "validate" && (
          <div className="p-8 text-center space-y-4">
            <div className="animate-pulse">
              <FileArchive className="h-10 w-10 text-muted-foreground mx-auto" />
            </div>
            <p className="text-sm">Validating backup file...</p>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && preview && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Backup Info */}
            <div className="bg-muted rounded-md p-3 text-sm space-y-1">
              <p className="font-medium">{preview.manifest.nota_version}</p>
              <p className="text-xs text-muted-foreground">
                Created: {new Date(preview.manifest.exported_at).toLocaleDateString()}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">{preview.new_sessions.length}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">{preview.conflicts.length}</p>
                <p className="text-xs text-muted-foreground">Conflicts</p>
              </div>
              <div className="bg-muted rounded-md p-2">
                <p className="text-lg font-semibold">{preview.backup_stats.session_count}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {/* Conflicts Section */}
            {preview.conflicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {preview.conflicts.length} sessions already exist
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Conflict Resolution:</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        value="skip_existing"
                        checked={conflictStrategy === "skip_existing"}
                        onChange={(e) => setConflictStrategy(e.target.value as ConflictStrategy)}
                        className="rounded-full"
                      />
                      Skip existing, import new only
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        value="replace"
                        checked={conflictStrategy === "replace"}
                        onChange={(e) => setConflictStrategy(e.target.value as ConflictStrategy)}
                        className="rounded-full"
                      />
                      Replace with backup versions
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        value="keep_both"
                        checked={conflictStrategy === "keep_both"}
                        onChange={(e) => setConflictStrategy(e.target.value as ConflictStrategy)}
                        className="rounded-full"
                      />
                      Keep both (rename duplicates)
                    </label>
                  </div>
                </div>

                {conflictStrategy === "replace" && (
                  <p className="text-xs text-destructive">
                    Warning: This will overwrite your current sessions with the backup versions.
                  </p>
                )}
              </div>
            )}

            {/* New Sessions Preview */}
            {preview.new_sessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">New sessions to import:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                  {preview.new_sessions.slice(0, 10).map((session) => (
                    <p key={session.id} className="text-xs truncate">
                      {session.title}
                    </p>
                  ))}
                  {preview.new_sessions.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      +{preview.new_sessions.length - 10} more...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="bg-amber-500/10 rounded-md p-3 space-y-1">
                <p className="text-sm font-medium text-amber-500">Warnings:</p>
                {validation.warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-amber-500">{warning}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
              <Button size="sm" onClick={handleImport}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Import {preview.new_sessions.length > 0 || preview.conflicts.length > 0
                  ? `${preview.new_sessions.length + (conflictStrategy !== "skip_existing" ? preview.conflicts.length : 0)} sessions`
                  : ""
                }
              </Button>
            </div>
          </div>
        )}

        {/* Progress Step */}
        {step === "progress" && (
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {importProgress?.phase || "Starting..."}
                </span>
                <span className="font-medium">{importProgress?.percent || 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${importProgress?.percent || 0}%` }}
                />
              </div>
            </div>

            {importProgress?.current_file && (
              <p className="text-xs text-muted-foreground truncate">
                {importProgress.current_file}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {importProgress
                ? `${importProgress.processed} / ${importProgress.total} files`
                : "Preparing..."}
            </p>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && lastImportResult && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
              <div>
                <p className="font-medium">Import complete!</p>
                <p className="text-sm text-muted-foreground">
                  {lastImportResult.imported_count} sessions imported
                </p>
              </div>
            </div>

            <div className="bg-muted rounded-md p-3 text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Imported</p>
                  <p className="font-medium">{lastImportResult.imported_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Skipped</p>
                  <p className="font-medium">{lastImportResult.skipped_count}</p>
                </div>
                {lastImportResult.replaced_count > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">Replaced</p>
                    <p className="font-medium">{lastImportResult.replaced_count}</p>
                  </div>
                )}
                {lastImportResult.renamed_count > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">Renamed</p>
                    <p className="font-medium">{lastImportResult.renamed_count}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Your sessions are now available. You may need to refresh the session list.
            </p>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <FileX className="h-8 w-8" />
              <div>
                <p className="font-medium">Import failed</p>
                <p className="text-sm text-muted-foreground">
                  Could not import the backup file
                </p>
              </div>
            </div>

            {(validation?.errors?.length ?? 0) > 0 && (
              <div className="bg-destructive/10 rounded-md p-3">
                <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                  {validation?.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {importError && (
              <div className="bg-destructive/10 rounded-md p-3">
                <p className="text-xs text-destructive">{importError}</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
