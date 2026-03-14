use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Planned,
    Active,
    Paused,
    Completed,
    Cancelled,
}

impl ToString for SessionStatus {
    fn to_string(&self) -> String {
        match self {
            SessionStatus::Planned => "planned".to_string(),
            SessionStatus::Active => "active".to_string(),
            SessionStatus::Paused => "paused".to_string(),
            SessionStatus::Completed => "completed".to_string(),
            SessionStatus::Cancelled => "cancelled".to_string(),
        }
    }
}

impl From<String> for SessionStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "planned" => SessionStatus::Planned,
            "active" => SessionStatus::Active,
            "paused" => SessionStatus::Paused,
            "completed" => SessionStatus::Completed,
            "cancelled" => SessionStatus::Cancelled,
            _ => SessionStatus::Planned,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub status: SessionStatus,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,

    pub total_elapsed_seconds: i64,
    pub active_elapsed_seconds: i64,
    pub break_elapsed_seconds: i64,

    pub goal_summary: Option<String>,
    pub goal_specific: Option<String>,
    pub goal_measurable: Option<String>,
    pub goal_achievable: Option<String>,
    pub goal_relevant: Option<String>,
    pub goal_time_bound: Option<String>,

    pub expected_output: Option<String>,
    pub outcome_summary: Option<String>,
    pub reflection_summary: Option<String>,
    pub success_criteria_met: Option<i64>,

    pub notes_markdown_path: String,
    pub reflection_markdown_path: Option<String>,

    pub toggl_workspace_id: Option<String>,
    pub toggl_project_id: Option<String>,
    pub toggl_time_entry_id: Option<String>,
    pub last_toggl_sync_at: Option<DateTime<Utc>>,
    pub toggl_sync_status: Option<String>,

    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionInput {
    pub title: String,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub goal_summary: Option<String>,
    pub goal_specific: Option<String>,
    pub goal_measurable: Option<String>,
    pub goal_achievable: Option<String>,
    pub goal_relevant: Option<String>,
    pub goal_time_bound: Option<String>,
    pub expected_output: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSessionInput {
    pub title: Option<String>,
    pub status: Option<SessionStatus>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub total_elapsed_seconds: Option<i64>,
    pub active_elapsed_seconds: Option<i64>,
    pub break_elapsed_seconds: Option<i64>,
    pub goal_summary: Option<String>,
    pub goal_specific: Option<String>,
    pub goal_measurable: Option<String>,
    pub goal_achievable: Option<String>,
    pub goal_relevant: Option<String>,
    pub goal_time_bound: Option<String>,
    pub expected_output: Option<String>,
    pub outcome_summary: Option<String>,
    pub reflection_summary: Option<String>,
    pub success_criteria_met: Option<i64>,
    pub reflection_markdown_path: Option<String>,
    pub toggl_workspace_id: Option<String>,
    pub toggl_project_id: Option<String>,
    pub toggl_time_entry_id: Option<String>,
    pub toggl_sync_status: Option<String>,
}