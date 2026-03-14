import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores";

export function SessionEmptyState() {
  const { setCreateModalOpen } = useUIStore();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-medium mb-1">Welcome to Nota</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Start your first study session. Define a SMART goal, track your time,
          and capture notes along the way.
        </p>
        <Button onClick={() => setCreateModalOpen(true)} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Your First Session
        </Button>
      </div>
    </div>
  );
}
