import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Clock, Trash2, Edit3, X, Check, HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessionStore, useTimerStore } from "@/stores";
import { Session, SessionStatus } from "@/types";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { SmartGoalCard } from "./SmartGoalCard";
import { NotesEditor } from "@/components/editor/NotesEditor";

interface SessionDetailProps {
  session: Session;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const { updateSession, deleteSession, activeSession, setActiveSession, setSelectedSessionId, isLoading } = useSessionStore();
  const { state: timerState, elapsedSeconds, start, pause, resume, stop } = useTimerStore();
  const [activeTab, setActiveTab] = useState<"notes" | "reflection">("notes");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reflection fields
  const [outcomeSummary, setOutcomeSummary] = useState(session.outcome_summary || "");
  const [reflectionSummary, setReflectionSummary] = useState(session.reflection_summary || "");
  const [successCriteriaMet, setSuccessCriteriaMet] = useState<boolean | null>(
    session.success_criteria_met === undefined ? null : !!session.success_criteria_met
  );
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync reflection fields when session changes
  useEffect(() => {
    setOutcomeSummary(session.outcome_summary || "");
    setReflectionSummary(session.reflection_summary || "");
    setSuccessCriteriaMet(session.success_criteria_met === undefined ? null : !!session.success_criteria_met);
  }, [session.outcome_summary, session.reflection_summary, session.success_criteria_met]);

  const isActive = activeSession?.id === session.id;
  const currentElapsed = isActive ? elapsedSeconds : session.active_elapsed_seconds;

  const handleStart = async () => {
    try {
      const now = new Date().toISOString();
      await updateSession(session.id, {
        status: "active" as SessionStatus,
        started_at: session.started_at || now,
      });
      setActiveSession(session);
      await start(session.id);
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handlePause = async () => {
    try {
      await updateSession(session.id, {
        status: "paused" as SessionStatus,
        active_elapsed_seconds: currentElapsed,
      });
      await pause();
    } catch (err) {
      console.error("Failed to pause session:", err);
    }
  };

  const handleResume = async () => {
    try {
      await updateSession(session.id, {
        status: "active" as SessionStatus,
      });
      await resume();
    } catch (err) {
      console.error("Failed to resume session:", err);
    }
  };

  const handleStop = async () => {
    try {
      await updateSession(session.id, {
        status: "completed" as SessionStatus,
        ended_at: new Date().toISOString(),
        active_elapsed_seconds: currentElapsed,
      });
      await stop();
      setActiveSession(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to stop session:", errorMsg, err);
    }
  };

  const handleStartEditing = () => {
    setEditTitle(session.title);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditTitle(session.title);
    setIsEditing(false);
  };

  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle !== session.title) {
      await updateSession(session.id, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      handleCancelEditing();
    }
  };

  const handleSaveReflection = async () => {
    setIsSavingReflection(true);
    try {
      await updateSession(session.id, {
        outcome_summary: outcomeSummary.trim() || undefined,
        reflection_summary: reflectionSummary.trim() || undefined,
        success_criteria_met: successCriteriaMet === null ? undefined : successCriteriaMet ? 1 : 0,
      });
    } catch (err) {
      console.error("Failed to save reflection:", err);
    } finally {
      setIsSavingReflection(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSession(session.id);
      setShowDeleteDialog(false);
      setSelectedSessionId(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const statusColors: Record<SessionStatus, string> = {
    planned: "bg-muted-foreground/20 text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-500",
    paused: "bg-amber-500/20 text-amber-500",
    completed: "bg-blue-500/20 text-blue-500",
    cancelled: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  ref={inputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-sm py-0 flex-1"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleSaveTitle}
                  disabled={isLoading}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleCancelEditing}
                  disabled={isLoading}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-base font-medium truncate">{session.title}</h1>
                <Badge variant="subtle" className={cn("text-xs capitalize", statusColors[session.status])}>
                  {session.status}
                </Badge>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Created {formatDateTime(session.created_at)}
          </p>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEditing}>
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* SMART Goal */}
        <div className="mb-5">
          <SmartGoalCard session={session} />
        </div>

        {/* Timer Section */}
        <div className="mb-5 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border">
                <Clock className={cn("h-4 w-4 text-muted-foreground", timerState === "running" && "text-foreground")} />
              </div>
              <div>
                <div className="text-3xl font-mono font-medium tracking-tight tabular-nums">
                  {formatDuration(currentElapsed)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.status === "active" ? "Recording time..." : session.status === "paused" ? "Timer paused" : "Ready to start"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {session.status === "planned" && (
                <Button onClick={handleStart} size="sm" className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Start
                </Button>
              )}
              {session.status === "active" && (
                <>
                  <Button onClick={handlePause} variant="outline" size="sm" className="gap-1.5">
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                  <Button onClick={handleStop} variant="secondary" size="sm" className="gap-1.5">
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </Button>
                </>
              )}
              {session.status === "paused" && (
                <>
                  <Button onClick={handleResume} size="sm" className="gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                  <Button onClick={handleStop} variant="secondary" size="sm" className="gap-1.5">
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </Button>
                </>
              )}
              {session.status === "completed" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Session completed</span>
                  <Button variant="outline" size="sm" onClick={handleStart}>
                    Restart
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-4">
          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "px-2 py-1.5 text-sm font-medium transition-colors relative rounded-md",
              activeTab === "notes"
                ? "text-foreground bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Notes
          </button>
          {session.status === "completed" && (
            <button
              onClick={() => setActiveTab("reflection")}
              className={cn(
                "px-2 py-1.5 text-sm font-medium transition-colors relative rounded-md",
                activeTab === "reflection"
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Reflection
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "notes" ? (
          <div className="relative">
            <NotesEditor
              filePath={session.notes_markdown_path}
              autoSaveInterval={2000}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Criteria */}
            <div className="p-3 rounded-md border bg-muted/20">
              <h3 className="font-medium text-sm mb-3">Success Criteria Met?</h3>
              <div className="flex gap-2">
                <Button
                  variant={successCriteriaMet === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSuccessCriteriaMet(true);
                    handleSaveReflection();
                  }}
                  className="flex-1 gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Yes
                </Button>
                <Button
                  variant={successCriteriaMet === false ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSuccessCriteriaMet(false);
                    handleSaveReflection();
                  }}
                  className="flex-1 gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  No
                </Button>
                <Button
                  variant={successCriteriaMet === null ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSuccessCriteriaMet(null);
                    handleSaveReflection();
                  }}
                  className="flex-1 gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Unsure
                </Button>
              </div>
            </div>

            {/* Session Outcome */}
            <div className="p-3 rounded-md border bg-muted/20">
              <h3 className="font-medium text-sm mb-2">Session Outcome</h3>
              <textarea
                className="w-full min-h-[100px] p-2.5 rounded-md border bg-background text-sm resize-none focus-visible:ring-1.5 focus-visible:ring-ring focus-visible:outline-none"
                placeholder="What did you actually achieve?"
                value={outcomeSummary}
                onChange={(e) => setOutcomeSummary(e.target.value)}
                onBlur={handleSaveReflection}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Describe the actual results of this session.
              </p>
            </div>

            {/* Reflection */}
            <div className="p-3 rounded-md border bg-muted/20">
              <h3 className="font-medium text-sm mb-2">Reflection</h3>
              <textarea
                className="w-full min-h-[120px] p-2.5 rounded-md border bg-background text-sm resize-none focus-visible:ring-1.5 focus-visible:ring-ring focus-visible:outline-none"
                placeholder="What went well? What would you do differently?"
                value={reflectionSummary}
                onChange={(e) => setReflectionSummary(e.target.value)}
                onBlur={handleSaveReflection}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Reflect on the process, challenges, and learnings.
              </p>
            </div>

            {/* Save Status */}
            {isSavingReflection && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Saving...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Session</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete "{session.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
