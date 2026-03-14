export interface TogglTimeEntry {
  id: string;
  workspace_id: string;
  project_id?: string;
  description: string;
  start: string;
  stop?: string;
  duration: number;
  tags?: string[];
}

export interface TogglSyncStatus {
  session_id: string;
  status: 'pending' | 'synced' | 'failed';
  error?: string;
  last_sync_at?: string;
}

export interface CreateTogglEntryInput {
  session_id: string;
  description: string;
  workspace_id: string;
  project_id?: string;
  tags?: string[];
}

export interface UpdateTogglEntryInput {
  entry_id: string;
  stop?: string;
  duration?: number;
}