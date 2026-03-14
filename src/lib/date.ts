import { Session } from "@/types";
import { isToday, isYesterday, isThisWeek, formatDate } from "./utils";

export interface SessionGroup {
  label: string;
  sessions: Session[];
}

export function groupSessionsByDate(sessions: Session[]): SessionGroup[] {
  const groups: Map<string, Session[]> = new Map();

  // Sort sessions by created_at descending
  const sorted = [...sessions].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const session of sorted) {
    let key: string;

    if (isToday(session.created_at)) {
      key = "Today";
    } else if (isYesterday(session.created_at)) {
      key = "Yesterday";
    } else if (isThisWeek(session.created_at)) {
      key = "This Week";
    } else {
      const date = new Date(session.created_at);
      key = `${date.toLocaleDateString("en-US", { month: "long" })} ${date.getFullYear()}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(session);
  }

  // Convert to array with proper ordering
  const result: SessionGroup[] = [];
  const order = ["Today", "Yesterday", "This Week"];

  for (const label of order) {
    if (groups.has(label)) {
      result.push({ label, sessions: groups.get(label)! });
      groups.delete(label);
    }
  }

  // Add remaining groups sorted chronologically
  const remaining = Array.from(groups.entries())
    .sort((a, b) => {
      const dateA = new Date(a[1][0]?.created_at || 0);
      const dateB = new Date(b[1][0]?.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    })
    .map(([label, sessions]) => ({ label, sessions }));

  return [...result, ...remaining];
}

export function getSessionDateLabel(dateStr: string): string {
  if (isToday(dateStr)) return "Today";
  if (isYesterday(dateStr)) return "Yesterday";
  return formatDate(dateStr);
}
