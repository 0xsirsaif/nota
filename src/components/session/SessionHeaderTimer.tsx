import { Play, Pause, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { Session } from "@/types";

interface SessionHeaderTimerProps {
  session: Session;
  elapsedSeconds: number;
  timerState: "idle" | "running" | "paused";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
}

export function SessionHeaderTimer({
  session,
  elapsedSeconds,
  timerState,
  onStart,
  onPause,
  onResume,
  onStop,
  className,
}: SessionHeaderTimerProps) {
  // Planned state - show simple start button
  if (session.status === "planned") {
    return (
      <Button
        onClick={onStart}
        size="sm"
        className="h-7 gap-1.5 text-xs"
      >
        <Play className="h-3 w-3" />
        Start
      </Button>
    );
  }

  // Completed state - show minimal indicator or nothing
  if (session.status === "completed") {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span className="font-mono tabular-nums">
          {formatDuration(elapsedSeconds)}
        </span>
      </div>
    );
  }

  // Active or Paused - show compact timer chip
  const isRunning = session.status === "active" && timerState === "running";
  const isPaused = session.status === "paused";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        isRunning && "bg-muted/50 border-border",
        isPaused && "bg-muted/30 border-border/50",
        className
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isRunning && "bg-emerald-500 animate-pulse",
          isPaused && "bg-amber-500"
        )}
      />

      {/* Time display */}
      <span
        className={cn(
          "text-sm font-mono tabular-nums min-w-[60px] text-center",
          isPaused && "text-muted-foreground"
        )}
      >
        {formatDuration(elapsedSeconds)}
      </span>

      {/* Mini controls */}
      <div className="flex items-center">
        {isRunning ? (
          <Button
            onClick={onPause}
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-muted"
            title="Pause"
          >
            <Pause className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            onClick={onResume}
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-muted"
            title="Resume"
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
        <Button
          onClick={onStop}
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Stop"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
