import { useState } from "react";
import { Target, Calendar, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { useUIStore, useSessionStore } from "@/stores";
import { CreateSessionInput } from "@/types";

export function CreateSessionModal() {
  const { createModalOpen, setCreateModalOpen } = useUIStore();
  const { createSession } = useSessionStore();

  const [step, setStep] = useState<"basic" | "smart">("basic");
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [smartGoal, setSmartGoal] = useState({
    specific: "",
    measurable: "",
    achievable: "",
    relevant: "",
    timeBound: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const validateBasic = () => {
    const newErrors: { title?: string } = {};
    if (!title.trim()) {
      newErrors.title = "Session title is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateBasic()) {
      setStep("smart");
    }
  };

  // Convert HTML datetime-local format to RFC3339 format for backend
  const formatDateForBackend = (dateValue: string): string => {
    if (!dateValue) return "";
    // dateValue is in format "YYYY-MM-DDTHH:mm"
    // Append seconds and Z to make it RFC3339
    return `${dateValue}:00Z`;
  };

  const handleCreate = async () => {
    if (!validateBasic()) return;

    setIsSubmitting(true);

    const input: CreateSessionInput = {
      title: title.trim(),
      scheduled_for: scheduledFor ? formatDateForBackend(scheduledFor) : undefined,
      goal_summary: title.trim(),
      goal_specific: smartGoal.specific || undefined,
      goal_measurable: smartGoal.measurable || undefined,
      goal_achievable: smartGoal.achievable || undefined,
      goal_relevant: smartGoal.relevant || undefined,
      goal_time_bound: smartGoal.timeBound || undefined,
    };

    try {
      await createSession(input);
      setCreateModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("basic");
    setTitle("");
    setScheduledFor("");
    setSmartGoal({
      specific: "",
      measurable: "",
      achievable: "",
      relevant: "",
      timeBound: "",
    });
    setErrors({});
  };

  const handleClose = () => {
    setCreateModalOpen(false);
    resetForm();
  };

  const hasSmartContent = Object.values(smartGoal).some((v) => v.trim());
  const smartProgress = Object.values(smartGoal).filter((v) => v.trim()).length;

  return (
    <Dialog open={createModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            {step === "basic" ? "New Study Session" : "Define SMART Goal"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === "basic"
              ? "Plan your study session with intention."
              : `Step 2 of 2 • ${smartProgress}/5 fields completed`}
          </DialogDescription>
        </DialogHeader>

        {step === "basic" ? (
          <div className="flex flex-col max-h-[calc(90vh-64px)]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title field */}
              <div className="space-y-2">
                <label htmlFor="session-title" className="text-sm font-medium">
                  Session Title
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <Input
                  id="session-title"
                  placeholder="e.g., Deep dive into Rust ownership"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors({});
                  }}
                  autoFocus
                  className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                />
                {errors.title && (
                  <p id="title-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Scheduled For */}
              <div className="space-y-2">
                <label htmlFor="scheduled-for" className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Scheduled For
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <DatePicker
                  value={scheduledFor}
                  onChange={setScheduledFor}
                  placeholder="When do you plan to start?"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-border bg-background shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNext}
                className="h-8 text-xs"
              >
                {hasSmartContent ? (
                  <>
                    Edit SMART Goal
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    Add SMART Goal
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!title.trim() || isSubmitting}
                  className="h-8 text-xs"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col max-h-[calc(90vh-64px)]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* SMART Goal Fields */}
              <div className="space-y-2">
                <label htmlFor="smart-specific" className="text-sm font-medium">
                  Specific
                  <span className="text-muted-foreground font-normal ml-1">— What exactly will you do?</span>
                </label>
                <Textarea
                  id="smart-specific"
                  placeholder="e.g., Complete exercises 1-10 on chapter 3"
                  value={smartGoal.specific}
                  onChange={(e) =>
                    setSmartGoal({ ...smartGoal, specific: e.target.value })
                  }
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="smart-measurable" className="text-sm font-medium">
                  Measurable
                  <span className="text-muted-foreground font-normal ml-1">— How will you know you&apos;re done?</span>
                </label>
                <Textarea
                  id="smart-measurable"
                  placeholder="e.g., All exercises compile and pass tests"
                  value={smartGoal.measurable}
                  onChange={(e) =>
                    setSmartGoal({ ...smartGoal, measurable: e.target.value })
                  }
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="smart-achievable" className="text-sm font-medium">
                  Achievable
                  <span className="text-muted-foreground font-normal ml-1">— Is this realistic?</span>
                </label>
                <Textarea
                  id="smart-achievable"
                  placeholder="e.g., 10 exercises in 90 minutes is manageable"
                  value={smartGoal.achievable}
                  onChange={(e) =>
                    setSmartGoal({ ...smartGoal, achievable: e.target.value })
                  }
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="smart-relevant" className="text-sm font-medium">
                  Relevant
                  <span className="text-muted-foreground font-normal ml-1">— Why does this matter?</span>
                </label>
                <Textarea
                  id="smart-relevant"
                  placeholder="e.g., Fundamental to understanding Rust ownership"
                  value={smartGoal.relevant}
                  onChange={(e) =>
                    setSmartGoal({ ...smartGoal, relevant: e.target.value })
                  }
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="smart-timebound" className="text-sm font-medium">
                  Time-bound
                  <span className="text-muted-foreground font-normal ml-1">— How long will you spend?</span>
                </label>
                <Textarea
                  id="smart-timebound"
                  placeholder="e.g., 90 minutes of focused work"
                  value={smartGoal.timeBound}
                  onChange={(e) =>
                    setSmartGoal({ ...smartGoal, timeBound: e.target.value })
                  }
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-between p-5 border-t border-border bg-background shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("basic")}
                className="h-8 text-xs"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!title.trim() || isSubmitting}
                  className="h-8 text-xs"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
