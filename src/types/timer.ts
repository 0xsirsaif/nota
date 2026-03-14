export type TimerState = 'idle' | 'running' | 'paused';

export interface TimerData {
  id: number;
  active_session_id?: string;
  state: TimerState;
  last_tick_at?: string;
  accumulated_seconds: number;
}

export interface TimerStatus {
  session_id?: string;
  state: TimerState;
  elapsed_seconds: number;
  is_active: boolean;
}