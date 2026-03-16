import { useState } from "react";
import { ChevronLeft, Play, Square, RotateCcw } from "lucide-react";
import { useSessionStore, useTimerStore, useUIStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/mobile/SessionList";
import { NotesEditor } from "@/components/editor/NotesEditor";
import { formatDuration } from "@/lib/utils";

type MobileView = "list" | "detail" | "timer";

export function MobileLayout() {
  const [currentView, setCurrentView] = useState<MobileView>("list");
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionStore();
  const { state, elapsedSeconds, start, pause, resume, stop } = useTimerStore();
  const { setCreateModalOpen } = useUIStore();

  const isRunning = state === "running";
  const isPaused = state === "paused";

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const handleSessionSelect = (id: string) => {
    setSelectedSessionId(id);
    setCurrentView("detail");
  };

  const handleBack = () => {
    if (currentView === "detail") {
      setCurrentView("list");
      setSelectedSessionId(null);
    } else if (currentView === "timer") {
      setCurrentView("detail");
    }
  };

  const handleStartTimer = () => {
    if (selectedSession) {
      start(selectedSession.id);
      setCurrentView("timer");
    }
  };

  const handleStopTimer = () => {
    stop();
    setCurrentView("detail");
  };

  // Timer View
  if (currentView === "timer") {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="h-14 flex items-center px-4 border-b">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBack}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="ml-2 font-medium truncate">{selectedSession?.title || "Focus"}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-7xl font-mono font-bold tracking-tight mb-8">
            {formatDuration(elapsedSeconds)}
          </div>

          <div className="flex gap-4">
            {isRunning && !isPaused ? (
              <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={pause}>
                <span className="sr-only">Pause</span>
                <div className="h-6 w-2 bg-current rounded-sm" />
                <div className="h-6 w-2 bg-current rounded-sm ml-1" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
                onClick={isPaused ? resume : () => {}}
              >
                <Play className="h-8 w-8 fill-current" />
              </Button>
            )}

            <Button
              size="lg"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={handleStopTimer}
            >
              <Square className="h-6 w-6 fill-current" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Detail View
  if (currentView === "detail" && selectedSession) {
    return (
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <div className="h-14 flex items-center px-4 border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleBack}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="ml-2 font-medium truncate flex-1">{selectedSession.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => setCurrentView("timer")}
          >
            <Play className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Goal Summary */}
            {selectedSession.goal_summary && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Goal</label>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-sm">{selectedSession.goal_summary}</p>
                </div>
              </div>
            )}

            {/* SMART Goals */}
            {(selectedSession.goal_specific || selectedSession.goal_measurable || selectedSession.goal_achievable ||
              selectedSession.goal_relevant || selectedSession.goal_time_bound) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">SMART Goals</label>
                <div className="space-y-2">
                  {selectedSession.goal_specific && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold">S</div>
                      <span className="text-sm">{selectedSession.goal_specific}</span>
                    </div>
                  )}
                  {selectedSession.goal_measurable && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold">M</div>
                      <span className="text-sm">{selectedSession.goal_measurable}</span>
                    </div>
                  )}
                  {selectedSession.goal_achievable && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold">A</div>
                      <span className="text-sm">{selectedSession.goal_achievable}</span>
                    </div>
                  )}
                  {selectedSession.goal_relevant && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold">R</div>
                      <span className="text-sm">{selectedSession.goal_relevant}</span>
                    </div>
                  )}
                  {selectedSession.goal_time_bound && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold">T</div>
                      <span className="text-sm">{selectedSession.goal_time_bound}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <div className="border rounded-lg overflow-hidden">
                <NotesEditor
                  filePath={selectedSession.notes_markdown_path}
                  autoSaveInterval={2000}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div
          className="border-t p-4 bg-background"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {!isRunning ? (
            <Button className="w-full h-12 text-base" onClick={handleStartTimer}>
              <Play className="h-5 w-5 mr-2" />
              Start Focus
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={handleBack}>
                <RotateCcw className="h-5 w-5 mr-2" />
                Background
              </Button>
              <Button variant="destructive" className="flex-1 h-12" onClick={handleStopTimer}>
                <Square className="h-5 w-5 mr-2" />
                Stop
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-auto">
        <SessionList onSelect={handleSessionSelect} />
      </div>

      {/* Floating Action Button */}
      <div
        className="absolute bottom-6 right-6"
        style={{ bottom: "max(24px, env(safe-area-inset-bottom) + 24px)" }}
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setCreateModalOpen(true)}
        >
          <span className="text-2xl leading-none">+</span>
        </Button>
      </div>
    </div>
  );
}
