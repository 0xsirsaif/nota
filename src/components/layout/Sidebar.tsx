import { useState, useMemo } from "react";
import { Plus, Search, Calendar, Clock, BookOpen, Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useUIStore, useSessionStore } from "@/stores";
import { Session } from "@/types";
import { formatDuration } from "@/lib/utils";
import { groupSessionsByDate } from "@/lib/date";
import { DuplicateSessionModal } from "@/components/session/DuplicateSessionModal";

type FilterType = "all" | "active" | "planned" | "completed";

interface SessionListItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onDuplicate?: (e: React.MouseEvent) => void;
}

function SessionListItem({ session, isActive, onClick, onDuplicate }: SessionListItemProps) {
  const statusColors: Record<string, string> = {
    planned: "bg-muted-foreground/30",
    active: "bg-emerald-500",
    paused: "bg-amber-500",
    completed: "bg-blue-500",
    cancelled: "bg-destructive/50",
  };

  return (
    <div
      className={cn(
        "w-full px-2 py-1.5 rounded-md transition-colors group relative",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/60 text-foreground"
      )}
    >
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              statusColors[session.status]
            )}
          />
          <span className="font-medium text-sm truncate flex-1 leading-5 pr-6">
            {session.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-3.5 mt-0.5">
          {session.status === "active" || session.status === "paused" ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(session.active_elapsed_seconds)}
            </span>
          ) : session.status === "completed" ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(session.active_elapsed_seconds)}
            </span>
          ) : null}
        </div>
      </button>

      {/* Duplicate button - appears on hover */}
      {onDuplicate && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDuplicate}
          title="Duplicate session"
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const { setCreateModalOpen } = useUIStore();
  const { sessions, selectedSessionId, setSelectedSessionId, isLoading } = useSessionStore();

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply status filter
    switch (activeFilter) {
      case "active":
        filtered = filtered.filter((s) => s.status === "active" || s.status === "paused");
        break;
      case "planned":
        filtered = filtered.filter((s) => s.status === "planned");
        break;
      case "completed":
        filtered = filtered.filter((s) => s.status === "completed");
        break;
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [sessions, activeFilter, searchQuery]);

  const groupedSessions = groupSessionsByDate(filteredSessions);

  const handleDuplicate = (session: Session) => {
    setDuplicateSourceId(session.id);
    setDuplicateModalOpen(true);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "planned", label: "Planned" },
  ];

  return (
    <aside
      className={cn(
        "w-[240px] min-w-[240px] bg-background border-r border-border flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h1 className="font-medium text-sm">Sessions</h1>
            {isLoading && (
              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>

      {/* Quick filters */}
      <div className="px-2 py-1.5 flex items-center gap-0.5">
        {filters.map((filter) => (
          <Button
            key={filter.key}
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 text-xs px-2 transition-colors",
              activeFilter === filter.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <Separator />

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-3">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-7 w-7 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sessions found</p>
            <p className="text-xs mt-1">{searchQuery ? "Try a different search" : "Create your first study session"}</p>
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-medium text-muted-foreground/70 px-2 py-1">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.sessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    isActive={selectedSessionId === session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    onDuplicate={(e) => {
                      e.stopPropagation();
                      handleDuplicate(session);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <Button
          className="w-full h-8 text-sm"
          onClick={() => setCreateModalOpen(true)}
          disabled={isLoading}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Session
        </Button>
      </div>

      <DuplicateSessionModal
        sourceSessionId={duplicateSourceId}
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) setDuplicateSourceId(null);
        }}
      />
    </aside>
  );
}
