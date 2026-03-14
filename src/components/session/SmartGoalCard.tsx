import { useState, useEffect } from "react";
import { Target, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionStore } from "@/stores";
import { Session } from "@/types";

interface SmartGoalCardProps {
  session: Session;
  className?: string;
}

interface SmartField {
  key: "specific" | "measurable" | "achievable" | "relevant" | "time_bound";
  label: string;
  desc: string;
  placeholder: string;
}

const smartFields: SmartField[] = [
  { key: "specific", label: "S", desc: "Specific", placeholder: "What exactly will you do?" },
  { key: "measurable", label: "M", desc: "Measurable", placeholder: "How will you know you're done?" },
  { key: "achievable", label: "A", desc: "Achievable", placeholder: "Is this realistic?" },
  { key: "relevant", label: "R", desc: "Relevant", placeholder: "Why does this matter?" },
  { key: "time_bound", label: "T", desc: "Time-bound", placeholder: "How long will you spend?" },
];

export function SmartGoalCard({ session, className }: SmartGoalCardProps) {
  const { updateSession, isLoading } = useSessionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedGoals, setEditedGoals] = useState({
    goal_summary: session.goal_summary || "",
    goal_specific: session.goal_specific || "",
    goal_measurable: session.goal_measurable || "",
    goal_achievable: session.goal_achievable || "",
    goal_relevant: session.goal_relevant || "",
    goal_time_bound: session.goal_time_bound || "",
  });

  // Update local state when session changes
  useEffect(() => {
    setEditedGoals({
      goal_summary: session.goal_summary || "",
      goal_specific: session.goal_specific || "",
      goal_measurable: session.goal_measurable || "",
      goal_achievable: session.goal_achievable || "",
      goal_relevant: session.goal_relevant || "",
      goal_time_bound: session.goal_time_bound || "",
    });
  }, [session]);

  const hasSmartGoal =
    session.goal_specific ||
    session.goal_measurable ||
    session.goal_achievable ||
    session.goal_relevant ||
    session.goal_time_bound ||
    session.goal_summary;

  const completedCount = smartFields.filter(
    (f) => session[`goal_${f.key}` as keyof Session]
  ).length;

  const handleSave = async () => {
    await updateSession(session.id, {
      goal_summary: editedGoals.goal_summary || undefined,
      goal_specific: editedGoals.goal_specific || undefined,
      goal_measurable: editedGoals.goal_measurable || undefined,
      goal_achievable: editedGoals.goal_achievable || undefined,
      goal_relevant: editedGoals.goal_relevant || undefined,
      goal_time_bound: editedGoals.goal_time_bound || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedGoals({
      goal_summary: session.goal_summary || "",
      goal_specific: session.goal_specific || "",
      goal_measurable: session.goal_measurable || "",
      goal_achievable: session.goal_achievable || "",
      goal_relevant: session.goal_relevant || "",
      goal_time_bound: session.goal_time_bound || "",
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={cn("p-3 rounded-md border bg-muted/30 space-y-3", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Edit SMART Goal</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={isLoading}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Goal Summary</label>
          <Textarea
            value={editedGoals.goal_summary}
            onChange={(e) =>
              setEditedGoals((prev) => ({ ...prev, goal_summary: e.target.value }))
            }
            placeholder="Summarize your goal in one sentence"
            className="min-h-[40px] text-sm"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          {smartFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center",
                    editedGoals[`goal_${field.key}` as keyof typeof editedGoals]
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {field.label}
                </span>
                <span className="text-xs text-muted-foreground">{field.desc}</span>
              </div>
              <Textarea
                value={editedGoals[`goal_${field.key}` as keyof typeof editedGoals]}
                onChange={(e) =>
                  setEditedGoals((prev) => ({
                    ...prev,
                    [`goal_${field.key}`]: e.target.value,
                  }))
                }
                placeholder={field.placeholder}
                className="min-h-[40px] text-xs"
                disabled={isLoading}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasSmartGoal) {
    return (
      <div
        className={cn(
          "p-3 rounded-md border border-dashed border-border bg-muted/30",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            <span className="text-sm">No SMART goal defined</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2"
            onClick={() => setIsEditing(true)}
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "p-3 rounded-md border bg-muted/30",
          className
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {session.goal_summary ? (
              <p className="text-sm font-medium leading-relaxed">
                {session.goal_summary}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No goal summary
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={() => setIsEditing(true)}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${(completedCount / smartFields.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {completedCount}/{smartFields.length}
          </span>
        </div>

        {/* SMART Fields */}
        <div className="flex gap-1.5">
          {smartFields.map((field) => (
            <Tooltip key={field.key}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "w-6 h-6 rounded text-xs font-medium flex items-center justify-center cursor-default transition-colors",
                    session[`goal_${field.key}` as keyof Session]
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {field.label}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium text-xs">{field.desc}</p>
                {session[`goal_${field.key}` as keyof Session] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(session[`goal_${field.key}` as keyof Session])}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
