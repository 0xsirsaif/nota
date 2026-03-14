export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  sidebar_width: number;
  inspector_width: number;
  inspector_collapsed: boolean;
  default_session_duration: number;
  auto_save_interval: number;
  last_opened_session?: string;
}

export interface TogglSettings {
  api_token?: string;
  is_connected: boolean;
  default_workspace_id?: string;
  default_project_id?: string;
  default_tags: string[];
  last_sync_at?: string;
}

export interface TogglWorkspace {
  id: string;
  name: string;
}

export interface TogglProject {
  id: string;
  workspace_id: string;
  name: string;
}