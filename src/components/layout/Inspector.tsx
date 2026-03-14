import { useState, useEffect } from "react";
import { PanelRight, Paperclip, Cloud, ChevronRight, FileText, Link as LinkIcon, X, ExternalLink, FolderOpen, Check, Loader2, RefreshCw, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useUIStore, useSessionStore, useAttachmentStore, useTogglStore, useSettingsStore } from "@/stores";
import { formatDateTime } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { DuplicateSessionModal } from "@/components/session/DuplicateSessionModal";

// Helper to format errors from Tauri
const formatError = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Check for message property first
    if (typeof e.message === "string") return e.message;
    // Tauri serialized enum: {"Database": "msg"} or {"FileSystem": "msg"}
    const entries = Object.entries(e);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      if (typeof value === "string") {
        return `${key}: ${value}`;
      }
    }
    // Fallback to JSON with circular reference handling
    try {
      return JSON.stringify(err, Object.getOwnPropertyNames(err));
    } catch {
      return "Unknown error";
    }
  }
  return String(err);
};

interface InspectorProps {
  className?: string;
}

export function Inspector({ className }: InspectorProps) {
  const { inspectorCollapsed, setInspectorCollapsed, setSettingsModalOpen } = useUIStore();
  const { selectedSessionId, sessions, activeSession, updateSession } = useSessionStore();
  const { attachments, isLoading, loadAttachments, addAttachment, deleteAttachment, openAttachment } = useAttachmentStore();
  const { togglSettings } = useSettingsStore();
  const {
    workspaces,
    projects,
    selectedWorkspaceId,
    selectedProjectId,
    loadWorkspaces,
    syncSession,
    setSelectedWorkspace,
    setSelectedProject,
  } = useTogglStore();

  // Load workspaces when Toggl becomes connected
  useEffect(() => {
    if (togglSettings.is_connected && workspaces.length === 0) {
      loadWorkspaces();
    }
  }, [togglSettings.is_connected, workspaces.length, loadWorkspaces]);

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const session =
    sessions.find((s) => s.id === selectedSessionId) ||
    activeSession ||
    null;

  useEffect(() => {
    if (session) {
      loadAttachments(session.id);
    }
  }, [session?.id, loadAttachments]);

  const handleAddFile = async () => {
    if (!session) return;

    const selected = await open({
      multiple: false,
      directory: false,
    });

    if (selected && typeof selected === "string") {
      const fileName = selected.split("/").pop() || "File";
      await addAttachment({
        session_id: session.id,
        type: "file",
        label: fileName,
        file_path: selected,
      });
    }
  };

  const handleAddLink = async () => {
    if (!session || !linkUrl.trim()) return;

    await addAttachment({
      session_id: session.id,
      type: "link",
      label: linkLabel.trim() || undefined,
      url: linkUrl.trim(),
    });

    setLinkUrl("");
    setLinkLabel("");
    setShowAddLink(false);
  };

  const handleOpen = async (id: string, _type: string) => {
    try {
      await openAttachment(id);
    } catch (err) {
      console.error("Failed to open attachment:", err);
      alert(`Failed to open: ${formatError(err)}`);
    }
  };

  const handleDuplicate = () => {
    if (!session) return;
    setDuplicateModalOpen(true);
  };

  const handleSyncToToggl = async () => {
    if (!session) return;
    setIsSyncing(true);
    try {
      // Get fresh session data from store to ensure we have the latest elapsed time
      const freshSession = sessions.find((s) => s.id === session.id) || session;
      const durationSeconds = freshSession.active_elapsed_seconds || 0;

      if (durationSeconds === 0) {
        alert("Cannot sync: Session has no recorded time. Make sure the timer was running.");
        setIsSyncing(false);
        return;
      }

      await syncSession(
        freshSession.id,
        freshSession.title,
        freshSession.started_at || freshSession.created_at,
        durationSeconds
      );
      // Refresh session data to show sync status
      await updateSession(freshSession.id, {});
      alert("Successfully synced to Toggl Track!");
    } catch (err) {
      console.error("Failed to sync:", err);
      alert(`Failed to sync: ${formatError(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (inspectorCollapsed) {
    return (
      <div
        className={cn(
          "w-9 min-w-9 bg-background border-l border-border flex flex-col items-center py-2",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setInspectorCollapsed(false)}
        >
          <PanelRight className="h-3.5 w-3.5" />
        </Button>
        <Separator className="my-1.5 w-5" />
        <Button variant="ghost" size="icon" className="h-7 w-7 relative">
          <Paperclip className="h-3.5 w-3.5" />
          {attachments.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center">
              {attachments.length}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Cloud className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "w-[260px] min-w-[260px] bg-background border-l border-border flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="p-2.5 border-b border-border flex items-center justify-between">
        <span className="font-medium text-sm">Inspector</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setInspectorCollapsed(true)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!session ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
          Select a session to view details
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Session Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Status
              </span>
              <Badge
                variant={
                  session.status === "active"
                    ? "default"
                    : session.status === "completed"
                    ? "subtle"
                    : "outline"
                }
                className="text-xs"
              >
                {session.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Created
              </span>
              <span className="text-xs text-foreground">
                {formatDateTime(session.created_at)}
              </span>
            </div>
            {session.started_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Started
                </span>
                <span className="text-xs text-foreground">
                  {formatDateTime(session.started_at)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-3 pb-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={handleDuplicate}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Duplicate Session
            </Button>
          </div>

          <Separator />

          {/* Attachments */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Attachments
                {attachments.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({attachments.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleAddFile}
                  title="Add file"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAddLink(!showAddLink)}
                  title="Add link"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Add Link Form */}
            {showAddLink && (
              <div className="space-y-2 mb-3 p-2 bg-muted/50 rounded-md">
                <Input
                  placeholder="URL (https://...)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder="Label (optional)"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  className="h-7 text-xs"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-6 text-xs flex-1"
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 px-0"
                    onClick={() => {
                      setShowAddLink(false);
                      setLinkUrl("");
                      setLinkLabel("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Attachments List */}
            {isLoading ? (
              <div className="text-xs text-muted-foreground py-2">Loading...</div>
            ) : attachments.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                No attachments yet
              </div>
            ) : (
              <div className="space-y-1">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
                  >
                    {attachment.type === "file" ? (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">
                        {attachment.label ||
                          (attachment.type === "file"
                            ? attachment.file_path?.split("/").pop()
                            : attachment.url) ||
                          "Untitled"}
                      </p>
                      {attachment.type === "link" && attachment.url && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {attachment.url}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Delete clicked for attachment:", attachment.id);
                        try {
                          await deleteAttachment(attachment.id);
                          console.log("Delete successful");
                        } catch (err) {
                          console.error("Failed to delete attachment:", err);
                          alert(`Failed to delete: ${formatError(err)}`);
                        }
                      }}
                      title="Delete"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Open clicked for attachment:", attachment.id, attachment.type);
                        handleOpen(attachment.id, attachment.type);
                      }}
                      title="Open"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Toggl Sync */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                Toggl Sync
              </h3>
              {togglSettings.is_connected ? (
                <Badge variant="default" className="text-xs flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Not connected
                </Badge>
              )}
            </div>

            {!togglSettings.is_connected ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground py-1">
                  Connect Toggl Track to sync time entries
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setSettingsModalOpen(true)}
                >
                  Configure in Settings
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Workspace Selection */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Workspace</label>
                  <select
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 pr-8 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                    value={selectedWorkspaceId || ""}
                    onChange={(e) => setSelectedWorkspace(Number(e.target.value) || null)}
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id} className="bg-background text-foreground">
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project Selection */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Project (optional)</label>
                  <select
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 pr-8 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                    value={selectedProjectId || ""}
                    onChange={(e) => setSelectedProject(Number(e.target.value) || null)}
                  >
                    <option value="" className="bg-background text-foreground">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-background text-foreground">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sync Status & Actions */}
                {session?.toggl_time_entry_id ? (
                  <div className="space-y-2 pt-1">
                    <Badge variant="subtle" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Synced
                    </Badge>
                    <div className="text-[10px] text-muted-foreground">
                      Last sync: {session.last_toggl_sync_at
                        ? new Date(session.last_toggl_sync_at).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>
                ) : session?.status === "completed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs mt-1"
                    onClick={handleSyncToToggl}
                    disabled={isSyncing || !selectedWorkspaceId}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Sync to Toggl
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground py-1">
                    Complete session to sync time entry
                  </div>
                )}

              </div>
            )}
          </div>

          <Separator />

          {/* Reflection */}
          {session.status === "completed" && (
            <div className="p-3">
              <h3 className="font-medium text-sm mb-2">Reflection</h3>
              {session.reflection_summary ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {session.reflection_summary}
                </p>
              ) : (
                <Button variant="outline" className="w-full h-8 text-xs" size="sm">
                  Add Reflection
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <DuplicateSessionModal
        sourceSessionId={session?.id || null}
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
      />
    </aside>
  );
}
