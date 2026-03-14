export type SessionStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Session {
  id: string;
  title: string;
  slug: string;
  status: SessionStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
  scheduled_for?: string;
  started_at?: string;
  paused_at?: string;
  ended_at?: string;

  // Timing (seconds)
  total_elapsed_seconds: number;
  active_elapsed_seconds: number;
  break_elapsed_seconds: number;

  // SMART Goal
  goal_summary?: string;
  goal_specific?: string;
  goal_measurable?: string;
  goal_achievable?: string;
  goal_relevant?: string;
  goal_time_bound?: string;

  // Outcomes
  expected_output?: string;
  outcome_summary?: string;
  reflection_summary?: string;
  success_criteria_met?: number;

  // File paths
  notes_markdown_path: string;
  reflection_markdown_path?: string;

  // Toggl
  toggl_workspace_id?: string;
  toggl_project_id?: string;
  toggl_time_entry_id?: string;
  last_toggl_sync_at?: string;
  toggl_sync_status?: 'pending' | 'synced' | 'failed';

  // Tags
  tags?: string[];
}

export interface CreateSessionInput {
  title: string;
  scheduled_for?: string;
  goal_summary?: string;
  goal_specific?: string;
  goal_measurable?: string;
  goal_achievable?: string;
  goal_relevant?: string;
  goal_time_bound?: string;
  expected_output?: string;
  tags?: string[];
}

export interface UpdateSessionInput {
  title?: string;
  status?: SessionStatus;
  scheduled_for?: string;
  started_at?: string;
  paused_at?: string;
  ended_at?: string;
  total_elapsed_seconds?: number;
  active_elapsed_seconds?: number;
  break_elapsed_seconds?: number;
  goal_summary?: string;
  goal_specific?: string;
  goal_measurable?: string;
  goal_achievable?: string;
  goal_relevant?: string;
  goal_time_bound?: string;
  expected_output?: string;
  outcome_summary?: string;
  reflection_summary?: string;
  success_criteria_met?: number;
  tags?: string[];
}

export interface SessionGroup {
  label: string;
  sessions: Session[];
}