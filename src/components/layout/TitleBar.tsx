import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  className?: string;
}

export function TitleBar({ className }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className={cn(
        "h-10 flex items-center justify-between bg-background border-b border-border select-none",
        className
      )}
    >
      {/* Left - App name */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-4 h-full"
      >
        <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">N</span>
        </div>
        <span className="text-sm font-medium text-foreground">Nota</span>
      </div>

      {/* Center - draggable area */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Right - Window controls */}
      <div className="flex items-center h-full">
        <button
          className="h-full w-10 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => {}}
          title="Minimize"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="h-full w-10 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => {}}
          title="Maximize"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          className="h-full w-10 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={() => {}}
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
