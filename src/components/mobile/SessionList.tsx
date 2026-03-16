import { useState, useMemo } from "react";
import { Search, Calendar, Clock, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUIStore, useSessionStore } from "@/stores";
import { Session } from "@/types";
import { formatDuration } from "@/lib/utils";
import { groupSessionsByDate } from "@/lib/date";

type FilterType = "all" | "active" | "planned" | "completed";

interface SessionListItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

function SessionListItem({ session, isActive, onClick }: SessionListItemProps) {
  const statusColors: Record<string, string> = {
    planned: "bg-muted-foreground/30",
    active: "bg-emerald-500",
    paused: "bg-amber-500",
    completed: "bg-blue-500",
    cancelled: "bg-destructive/50",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 transition-colors text-left border-b last:border-b-0",
        isActive
          ? "bg-accent/50"
          : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0 mt-1.5",
            statusColors[session.status]
          )}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base truncate leading-snug">
            {session.title}
          </h3>
          {(session.status === "active" || session.status === "paused" || session.status === "completed") && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(session.active_elapsed_seconds)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

interface SessionListProps {
  onSelect?: (id: string) => void;
}

export function SessionList({ onSelect }: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const { setCreateModalOpen } = useUIStore();
  const { sessions, selectedSessionId, setSelectedSessionId, isLoading } = useSessionStore();

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

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

    if (searchQuery) {
      filtered = filtered.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [sessions, activeFilter, searchQuery]);

  const groupedSessions = groupSessionsByDate(filteredSessions);

  const handleSelect = (id: string) => {
    setSelectedSessionId(id);
    onSelect?.(id);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "planned", label: "Planned" },
    { key: "completed", label: "Done" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 text-base"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((filter) => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              className="h-9 px-3 text-sm whitespace-nowrap flex-shrink-0"
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-base font-medium">No sessions found</p>
            <p className="text-sm mt-1 text-center">
              {searchQuery ? "Try a different search" : "Create your first study session"}
            </p>
            <Button
              className="mt-4"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
          </div>
        ) : (
          <div>
            {groupedSessions.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 border-y">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
                </div>
                <div>
                  {group.sessions.map((session) => (
                    <SessionListItem
                      key={session.id}
                      session={session}
                      isActive={selectedSessionId === session.id}
                      onClick={() => handleSelect(session.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
