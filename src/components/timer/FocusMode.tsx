import { useEffect } from "react";
import { Minimize2, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUIStore, useTimerStore, useSessionStore } from "@/stores";
import { formatDuration } from "@/lib/utils";

export function FocusMode() {
  const { focusMode, setFocusMode } = useUIStore();
  const { elapsedSeconds, state: timerState, pause, resume, breakReminderEnabled, toggleBreakReminder, breakIntervalMinutes } = useTimerStore();
  const { activeSession } = useSessionStore();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, setFocusMode]);

  if (!focusMode || !activeSession) return null;

  const progressPercent = (elapsedSeconds % (breakIntervalMinutes * 60)) / (breakIntervalMinutes * 60) * 100;

  const handlePause = async () => {
    try {
      await pause();
    } catch (err) {
      console.error("Failed to pause:", err);
    }
  };

  const handleResume = async () => {
    try {
      await resume();
    } catch (err) {
      console.error("Failed to resume:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center animate-fade-in">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
            <span className="text-background text-[10px] font-semibold">N</span>
          </div>
          <span className="font-medium text-sm text-muted-foreground truncate max-w-[300px]">{activeSession.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => toggleBreakReminder(!breakReminderEnabled)}
            title={breakReminderEnabled ? "Disable break reminders" : "Enable break reminders"}
          >
            {breakReminderEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFocusMode(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timer Display */}
      <div className="text-center">
        {/* Progress Ring */}
        <div className="relative mb-8">
          <svg className="w-64 h-64 -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-muted/30"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 120}`}
              strokeDashoffset={`${2 * Math.PI * 120 * (1 - progressPercent / 100)}`}
              className={cn(
                "transition-all duration-1000 ease-linear",
                timerState === "running" ? "text-foreground" : "text-muted-foreground"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "text-6xl font-mono font-medium tracking-tight tabular-nums",
                timerState === "running" && "text-foreground"
              )}
            >
              {formatDuration(elapsedSeconds)}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {timerState === "running"
            ? `Focusing... (${breakIntervalMinutes}min blocks)`
            : "Paused - Take a breath"}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-16 flex items-center gap-3">
        {timerState === "running" ? (
          <Button onClick={handlePause} size="lg" variant="outline" className="px-8">
            Pause
          </Button>
        ) : (
          <Button onClick={handleResume} size="lg" className="px-8">
            Resume
          </Button>
        )}
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 text-xs text-muted-foreground/60 text-center">
        <p>Press ESC to exit focus mode</p>
        {breakReminderEnabled && (
          <p className="mt-1">Break reminders enabled • {breakIntervalMinutes} minute intervals</p>
        )}
      </div>
    </div>
  );
}
