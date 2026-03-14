import { useState, useEffect, useRef } from "react";
import { Copy, ChevronDown, ChevronUp, AlertCircle, Tags, FileOutput, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionStore } from "@/stores";
import * as tauri from "@/lib/tauri";

interface DuplicateSessionModalProps {
  sourceSessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateSessionModal({
  sourceSessionId,
  open,
  onOpenChange,
}: DuplicateSessionModalProps) {
  const { createDuplicate } = useSessionStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [showSmartGoals, setShowSmartGoals] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [goalSummary, setGoalSummary] = useState("");
  const [goalSpecific, setGoalSpecific] = useState("");
  const [goalMeasurable, setGoalMeasurable] = useState("");
  const [goalAchievable, setGoalAchievable] = useState("");
  const [goalRelevant, setGoalRelevant] = useState("");
  const [goalTimeBound, setGoalTimeBound] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [tags, setTags] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load source session data when modal opens
  useEffect(() => {
    if (open && sourceSessionId) {
      loadSourceData();
    }
  }, [open, sourceSessionId]);

  // Focus and select title when data loads
  useEffect(() => {
    if (open && title && !isLoading) {
      // Small delay to ensure input is rendered
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
    }
  }, [open, title, isLoading]);

  const loadSourceData = async () => {
    if (!sourceSessionId) return;

    setIsLoading(true);
    try {
      const data = await tauri.prepareDuplicateSession(sourceSessionId);

      setTitle(data.suggested_title);
      setGoalSummary(data.goal_summary || "");
      setGoalSpecific(data.goal_specific || "");
      setGoalMeasurable(data.goal_measurable || "");
      setGoalAchievable(data.goal_achievable || "");
      setGoalRelevant(data.goal_relevant || "");
      setGoalTimeBound(data.goal_time_bound || "");
      setExpectedOutput(data.expected_output || "");
      setTags(data.tags?.join(", ") || "");

      // Show SMART goals if any have content
      const hasSmartContent =
        data.goal_specific ||
        data.goal_measurable ||
        data.goal_achievable ||
        data.goal_relevant ||
        data.goal_time_bound;
      setShowSmartGoals(!!hasSmartContent);
    } catch (err) {
      console.error("Failed to load source session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setGoalSummary("");
    setGoalSpecific("");
    setGoalMeasurable("");
    setGoalAchievable("");
    setGoalRelevant("");
    setGoalTimeBound("");
    setExpectedOutput("");
    setTags("");
    setErrors({});
    setShowSmartGoals(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const validate = () => {
    const newErrors: { title?: string } = {};
    if (!title.trim()) {
      newErrors.title = "Session title is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !sourceSessionId) return;

    setIsSubmitting(true);

    const input: tauri.CreateDuplicateInput = {
      title: title.trim(),
      goal_summary: goalSummary.trim() || undefined,
      goal_specific: goalSpecific.trim() || undefined,
      goal_measurable: goalMeasurable.trim() || undefined,
      goal_achievable: goalAchievable.trim() || undefined,
      goal_relevant: goalRelevant.trim() || undefined,
      goal_time_bound: goalTimeBound.trim() || undefined,
      expected_output: expectedOutput.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    try {
      await createDuplicate(sourceSessionId, input);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create duplicate:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const smartProgress = [
    goalSpecific,
    goalMeasurable,
    goalAchievable,
    goalRelevant,
    goalTimeBound,
  ].filter((v) => v.trim()).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-muted-foreground" />
            Duplicate Session
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Review and edit before creating the copy
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-muted-foreground text-sm">
              Loading session data...
            </div>
          </div>
        ) : (
          <div className="flex flex-col max-h-[calc(90vh-64px)]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title field */}
              <div className="space-y-2">
                <label htmlFor="duplicate-title" className="text-sm font-medium">
                  Title
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <Input
                  ref={titleInputRef}
                  id="duplicate-title"
                  placeholder="Session title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors({});
                  }}
                  className={
                    errors.title
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) {
                      handleCreate();
                    }
                  }}
                />
                {errors.title && (
                  <p
                    id="title-error"
                    className="text-xs text-destructive flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Goal Summary */}
              <div className="space-y-2">
                <label
                  htmlFor="duplicate-goal-summary"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  Goal Summary
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="duplicate-goal-summary"
                  placeholder="Brief summary of the goal"
                  value={goalSummary}
                  onChange={(e) => setGoalSummary(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              {/* SMART Goals - Collapsible */}
              <div className="border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSmartGoals(!showSmartGoals)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm font-medium">
                    SMART Goals
                    {smartProgress > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({smartProgress}/5)
                      </span>
                    )}
                  </span>
                  {showSmartGoals ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showSmartGoals && (
                  <div className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Specific
                      </label>
                      <Textarea
                        placeholder="What exactly will you do?"
                        value={goalSpecific}
                        onChange={(e) => setGoalSpecific(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Measurable
                      </label>
                      <Textarea
                        placeholder="How will you know you're done?"
                        value={goalMeasurable}
                        onChange={(e) => setGoalMeasurable(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Achievable
                      </label>
                      <Textarea
                        placeholder="Is this realistic?"
                        value={goalAchievable}
                        onChange={(e) => setGoalAchievable(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Relevant
                      </label>
                      <Textarea
                        placeholder="Why does this matter?"
                        value={goalRelevant}
                        onChange={(e) => setGoalRelevant(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Time-bound
                      </label>
                      <Textarea
                        placeholder="How long will you spend?"
                        value={goalTimeBound}
                        onChange={(e) => setGoalTimeBound(e.target.value)}
                        className="min-h-[50px] text-sm resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Expected Output */}
              <div className="space-y-2">
                <label
                  htmlFor="duplicate-expected-output"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <FileOutput className="h-3.5 w-3.5 text-muted-foreground" />
                  Expected Output
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="duplicate-expected-output"
                  placeholder="What will you produce?"
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label
                  htmlFor="duplicate-tags"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                  Tags
                  <span className="text-muted-foreground font-normal">
                    (optional, comma-separated)
                  </span>
                </label>
                <Input
                  id="duplicate-tags"
                  placeholder="e.g., book, study, chapter"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border bg-background shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!title.trim() || isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? "Creating..." : "Create Duplicate"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
