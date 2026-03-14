import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSessionStore, useTimerStore } from "@/stores";
import { SessionDetail } from "@/components/session/SessionDetail";
import { SessionEmptyState } from "@/components/session/SessionEmptyState";

interface WorkspaceProps {
  className?: string;
}

export function Workspace({ className }: WorkspaceProps) {
  const { selectedSessionId, sessions, activeSession } = useSessionStore();
  const { tick } = useTimerStore();

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ||
    activeSession ||
    null;

  // Timer tick effect - runs every second to update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className={cn(
        "flex-1 bg-background overflow-hidden flex flex-col",
        className
      )}
    >
      {selectedSession ? (
        <SessionDetail session={selectedSession} />
      ) : (
        <SessionEmptyState />
      )}
    </main>
  );
}
