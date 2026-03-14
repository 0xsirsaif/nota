import * as React from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Format date for datetime-local input value (YYYY-MM-DDTHH:mm)
function formatForInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Parse datetime-local value to Date
function parseInputValue(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// Format for display
function formatDisplay(value: string): string {
  const date = parseInputValue(value);
  if (!date) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleQuickSelect = (type: "now" | "today" | "tomorrow") => {
    const now = new Date();
    let date: Date;

    switch (type) {
      case "now":
        date = now;
        break;
      case "today":
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
        break;
      case "tomorrow":
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
        break;
      default:
        date = now;
    }

    onChange(formatForInput(date));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const displayValue = value ? formatDisplay(value) : "";
  const hasValue = !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 text-sm transition-colors",
            "hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{hasValue ? displayValue : placeholder}</span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-3 bg-popover border border-border rounded-md shadow-lg"
        align="start"
        sideOffset={4}
      >
        {/* Quick Select Presets */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickSelect("now")}
          >
            <Clock className="h-3 w-3 mr-1" />
            Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickSelect("today")}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickSelect("tomorrow")}
          >
            Tomorrow
          </Button>
        </div>

        {/* Hidden native input for actual datetime selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Custom date & time
          </label>
          <input
            ref={inputRef}
            type="datetime-local"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "flex h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm",
              "focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-ring",
              "[color-scheme:dark]"
            )}
          />
        </div>

        {/* Clear button */}
        {hasValue && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs w-full text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
