import { Settings as SettingsIcon, User, Palette, Cloud, Check, Loader2, Database, Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore, useSettingsStore, useBackupStore, formatBytes } from "@/stores";
import { ExportDialog, ImportDialog } from "@/components/backup";
import { useState, useEffect } from "react";

type SettingsTab = "general" | "appearance" | "toggl" | "backup";

export function SettingsModal() {
  const { settingsModalOpen, setSettingsModalOpen } = useUIStore();
  const { appSettings, togglSettings, updateAppSettings, validateAndConnectToggl, disconnectToggl } = useSettingsStore();
  const { stats, loadStats } = useBackupStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [togglToken, setTogglToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    if (settingsModalOpen) {
      loadStats();
    }
  }, [settingsModalOpen, loadStats]);

  return (
    <>
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden p-0 gap-0">
          <div className="flex h-[480px]">
            {/* Sidebar */}
            <div className="w-40 border-r border-border p-2 bg-muted/20">
              <nav className="space-y-0.5">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === "general"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  General
                </button>
                <button
                  onClick={() => setActiveTab("appearance")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === "appearance"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Appearance
                </button>
                <button
                  onClick={() => setActiveTab("toggl")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === "toggl"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Cloud className="h-3.5 w-3.5" />
                  Toggl Track
                </button>
                <button
                  onClick={() => setActiveTab("backup")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === "backup"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  Backup
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <DialogHeader className="px-4 py-3 border-b border-border">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <SettingsIcon className="h-4 w-4" />
                  {activeTab === "general" && "General"}
                  {activeTab === "appearance" && "Appearance"}
                  {activeTab === "toggl" && "Toggl Track"}
                  {activeTab === "backup" && "Backup & Export"}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "general" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Default Session Duration</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={appSettings.default_session_duration}
                          onChange={(e) =>
                            updateAppSettings({
                              default_session_duration: parseInt(e.target.value) || 60,
                            })
                          }
                          className="w-16 px-2 py-1.5 rounded-md border bg-background text-sm"
                        />
                        <span className="text-xs text-muted-foreground">minutes</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Auto-save Interval</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={appSettings.auto_save_interval / 1000}
                          onChange={(e) =>
                            updateAppSettings({
                              auto_save_interval: (parseInt(e.target.value) || 2) * 1000,
                            })
                          }
                          className="w-16 px-2 py-1.5 rounded-md border bg-background text-sm"
                        />
                        <span className="text-xs text-muted-foreground">seconds</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "appearance" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Theme</label>
                      <div className="flex gap-1.5">
                        {(["dark", "light", "system"] as const).map((theme) => (
                          <button
                            key={theme}
                            onClick={() => updateAppSettings({ theme })}
                            className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                              appSettings.theme === theme
                                ? "border-foreground bg-foreground text-background"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            {theme.charAt(0).toUpperCase() + theme.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "toggl" && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-md border bg-muted/20">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-sm">Toggl Track Integration</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sync your study sessions with Toggl Track
                          </p>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            togglSettings.is_connected
                              ? "bg-emerald-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                      </div>

                      {!togglSettings.is_connected ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Enter your Toggl Track API token to connect:
                          </p>
                          <input
                            type="password"
                            placeholder="API Token"
                            value={togglToken}
                            onChange={(e) => {
                              setTogglToken(e.target.value);
                              setValidationError(null);
                            }}
                            className="w-full px-2 py-1.5 rounded-md border bg-background text-sm"
                          />
                          {validationError && (
                            <p className="text-xs text-destructive">{validationError}</p>
                          )}
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={async () => {
                              if (!togglToken.trim()) return;
                              setIsValidating(true);
                              setValidationError(null);
                              const isValid = await validateAndConnectToggl(togglToken);
                              setIsValidating(false);
                              if (!isValid) {
                                setValidationError("Invalid API token. Please check your Toggl Track Profile Settings.");
                              } else {
                                setTogglToken("");
                              }
                            }}
                            disabled={!togglToken.trim() || isValidating}
                          >
                            {isValidating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            Connect
                          </Button>
                          <p className="text-[10px] text-muted-foreground">
                            Find your API token in Toggl Track Profile Settings
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 rounded-md px-3 py-2">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">Connected to Toggl Track</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs w-full"
                            onClick={async () => {
                              await disconnectToggl();
                              setTogglToken("");
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "backup" && (
                  <div className="space-y-4">
                    {/* Data Overview */}
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

                    {/* Export Section */}
                    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
                      <div>
                        <h3 className="font-medium text-sm flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Full Backup
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Export all sessions, notes, attachments, and settings to a .nota file.
                        </p>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs w-full"
                        onClick={() => setExportDialogOpen(true)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Export Full Backup
                      </Button>
                    </div>

                    {/* Import Section */}
                    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
                      <div>
                        <h3 className="font-medium text-sm flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Import
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Restore from a .nota backup file.
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs w-full"
                        onClick={() => setImportDialogOpen(true)}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Import from Backup
                      </Button>
                    </div>

                    {/* Info */}
                    <p className="text-xs text-muted-foreground">
                      Backups include your SQLite database, all markdown notes, and attached files.
                      Store them in a safe location like cloud storage or an external drive.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </>
  );
}
