import { invoke } from "@tauri-apps/api/core";
import type { Session, CreateSessionInput, UpdateSessionInput, Attachment, CreateAttachmentInput } from "@/types";

// Duplicate session data from backend
export interface DuplicateSessionData {
  source_session_id: string;
  suggested_title: string;
  goal_summary?: string;
  goal_specific?: string;
  goal_measurable?: string;
  goal_achievable?: string;
  goal_relevant?: string;
  goal_time_bound?: string;
  expected_output?: string;
  tags?: string[];
}

// Input for creating duplicate with user-edited values
export interface CreateDuplicateInput {
  title: string;
  goal_summary?: string;
  goal_specific?: string;
  goal_measurable?: string;
  goal_achievable?: string;
  goal_relevant?: string;
  goal_time_bound?: string;
  expected_output?: string;
  tags?: string[];
}

// Session commands
export async function createSession(input: CreateSessionInput): Promise<Session> {
  return invoke("create_session", { input });
}

export async function getSessions(): Promise<Session[]> {
  return invoke("get_sessions");
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session> {
  return invoke("update_session", { id, input });
}

export async function deleteSession(id: string): Promise<void> {
  return invoke("delete_session", { id });
}

export async function prepareDuplicateSession(sessionId: string): Promise<DuplicateSessionData> {
  return invoke("prepare_duplicate_session", { sessionId });
}

export async function createDuplicateSession(
  sourceSessionId: string,
  input: CreateDuplicateInput
): Promise<Session> {
  return invoke("create_duplicate_session", { sourceSessionId, input });
}

// File system commands
export async function readMarkdownFile(relativePath: string): Promise<string> {
  return invoke("read_markdown_file", { relativePath });
}

export async function writeMarkdownFile(relativePath: string, content: string): Promise<void> {
  return invoke("write_markdown_file", { relativePath, content });
}

// Settings commands
export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

// Timer commands
export async function getTimerState(): Promise<{
  activeSessionId: string | null;
  state: "idle" | "running" | "paused";
  accumulatedSeconds: number;
}> {
  return invoke("get_timer_state");
}

export async function updateTimerState(state: {
  activeSessionId?: string | null;
  state?: "idle" | "running" | "paused";
  accumulatedSeconds?: number;
}): Promise<void> {
  return invoke("update_timer_state", { state });
}

// Attachment commands
export async function addAttachment(input: CreateAttachmentInput): Promise<Attachment> {
  return invoke("add_attachment", { input });
}

export async function getAttachments(sessionId: string): Promise<Attachment[]> {
  return invoke("get_attachments", { sessionId });
}

export async function deleteAttachment(id: string): Promise<void> {
  return invoke("delete_attachment", { id });
}

export async function openAttachment(id: string): Promise<void> {
  return invoke("open_attachment", { id });
}

// Toggl commands
export async function togglValidateToken(apiToken: string): Promise<boolean> {
  return invoke("toggl_validate_token", { apiToken });
}

export async function togglGetWorkspaces(): Promise<{ id: number; name: string }[]> {
  return invoke("toggl_get_workspaces");
}

export async function togglGetProjects(workspaceId: number): Promise<{ id: number; name: string; workspace_id: number }[]> {
  return invoke("toggl_get_projects", { workspaceId });
}

export async function togglCreateTimeEntry(
  sessionId: string,
  workspaceId: number,
  projectId: number | null,
  description: string,
  startTime: string,
  durationSeconds: number
): Promise<{ id: number; description: string }> {
  return invoke("toggl_create_time_entry", {
    sessionId,
    workspaceId,
    projectId,
    description,
    startTime,
    durationSeconds,
  });
}

export async function togglDisconnect(): Promise<void> {
  return invoke("toggl_disconnect");
}

export async function togglGetSyncStatus(sessionId: string): Promise<{
  synced: boolean;
  timeEntryId?: string;
  lastSync?: string;
  status: string;
  workspaceId?: string;
}> {
  return invoke("toggl_get_sync_status", { sessionId });
}
