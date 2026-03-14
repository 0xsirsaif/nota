use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimerState {
    Idle,
    Running,
    Paused,
}

impl ToString for TimerState {
    fn to_string(&self) -> String {
        match self {
            TimerState::Idle => "idle".to_string(),
            TimerState::Running => "running".to_string(),
            TimerState::Paused => "paused".to_string(),
        }
    }
}

impl From<String> for TimerState {
    fn from(s: String) -> Self {
        match s.as_str() {
            "idle" => TimerState::Idle,
            "running" => TimerState::Running,
            "paused" => TimerState::Paused,
            _ => TimerState::Idle,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerData {
    pub id: i64,
    pub active_session_id: Option<String>,
    pub state: TimerState,
    pub last_tick_at: Option<DateTime<Utc>>,
    pub accumulated_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerStatus {
    pub session_id: Option<String>,
    pub state: TimerState,
    pub elapsed_seconds: i64,
    pub is_active: bool,
}