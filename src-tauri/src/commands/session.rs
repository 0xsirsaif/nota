use chrono::Utc;
use tauri::{AppHandle, Manager};

use crate::db;
use crate::error::{NotaError, Result};
use crate::models::session::*;
use serde::{Deserialize, Serialize};

/// Data returned to pre-fill the duplicate session modal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateSessionData {
    pub source_session_id: String,
    pub suggested_title: String,
    pub goal_summary: Option<String>,
    pub goal_specific: Option<String>,
    pub goal_measurable: Option<String>,
    pub goal_achievable: Option<String>,
    pub goal_relevant: Option<String>,
    pub goal_time_bound: Option<String>,
    pub expected_output: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Input for creating a duplicate session with user-edited values
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDuplicateInput {
    pub title: String,
    pub goal_summary: Option<String>,
    pub goal_specific: Option<String>,
    pub goal_measurable: Option<String>,
    pub goal_achievable: Option<String>,
    pub goal_relevant: Option<String>,
    pub goal_time_bound: Option<String>,
    pub expected_output: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Generate a copy title with (N) suffix
/// "Chapter 10" -> "Chapter 10 (1)"
/// "Chapter 10 (1)" -> "Chapter 10 (2)"
async fn generate_copy_title(pool: &sqlx::SqlitePool, base_title: &str) -> Result<String> {
    // Find the highest existing copy number
    let pattern = format!("{} (%)", base_title);
    let existing_copies: Vec<(String,)> = sqlx::query_as(
        "SELECT title FROM sessions WHERE title LIKE ?1"
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    let mut max_num = 0;
    for (title,) in existing_copies {
        // Extract number from "Title (N)"
        if let Some(start) = title.rfind('(') {
            if let Some(end) = title.rfind(')') {
                if let Ok(num) = title[start + 1..end].parse::<i32>() {
                    if num > max_num {
                        max_num = num;
                    }
                }
            }
        }
    }

    Ok(format!("{} ({})", base_title, max_num + 1))
}

#[tauri::command]
pub async fn prepare_duplicate_session(app: AppHandle, session_id: String) -> Result<DuplicateSessionData> {
    let pool = db::get_db_pool(&app)?;

    // Fetch source session
    let source: SessionRow = sqlx::query_as::<_, SessionRow>(
        "SELECT * FROM sessions WHERE id = ?1"
    )
    .bind(&session_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| NotaError::NotFound("Session not found".to_string()))?;

    // Generate suggested title
    let suggested_title = generate_copy_title(&pool, &source.title).await?;

    // Parse tags
    let tags: Option<Vec<String>> = source.tags.and_then(|t| serde_json::from_str(&t).ok());

    Ok(DuplicateSessionData {
        source_session_id: session_id,
        suggested_title,
        goal_summary: source.goal_summary,
        goal_specific: source.goal_specific,
        goal_measurable: source.goal_measurable,
        goal_achievable: source.goal_achievable,
        goal_relevant: source.goal_relevant,
        goal_time_bound: source.goal_time_bound,
        expected_output: source.expected_output,
        tags,
    })
}

#[tauri::command]
pub async fn create_duplicate_session(
    app: AppHandle,
    source_session_id: String,
    input: CreateDuplicateInput,
) -> Result<Session> {
    let pool = db::get_db_pool(&app)?;
    let now = Utc::now();

    // 1. Fetch source session (for notes content and attachments)
    let source: SessionRow = sqlx::query_as::<_, SessionRow>(
        "SELECT * FROM sessions WHERE id = ?1"
    )
    .bind(&source_session_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| NotaError::NotFound("Source session not found".to_string()))?;

    // 2. Generate new session ID and slug
    let new_id = format!("sess_{}", uuid::Uuid::new_v4().simple());
    let new_slug = format!(
        "{}_{}",
        now.format("%Y%m%d_%H%M%S"),
        slug::slugify(&input.title).replace("-", "_")
    );

    // 3. Create new notes file path
    let new_notes_path = format!("sessions/{}/notes.md", new_slug);

    // 4. Copy notes file content if it exists
    let sessions_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?
        .join("sessions");

    let source_notes_file = sessions_dir.join(&source.notes_markdown_path);
    if source_notes_file.exists() {
        let new_notes_file = sessions_dir.join(&new_notes_path);

        // Create parent directory
        if let Some(parent) = new_notes_file.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| NotaError::FileSystem(e.to_string()))?;
        }

        // Copy file content
        let content = tokio::fs::read_to_string(&source_notes_file)
            .await
            .map_err(|e| NotaError::FileSystem(e.to_string()))?;

        tokio::fs::write(&new_notes_file, content)
            .await
            .map_err(|e| NotaError::FileSystem(e.to_string()))?;
    }

    // 5. Serialize tags
    let tags_json = input.tags.map(|t| serde_json::to_string(&t).unwrap_or_default());

    // 6. Insert new session (reset timing, status, sync data)
    sqlx::query(
        r#"
        INSERT INTO sessions (
            id, title, slug, status, created_at, updated_at, scheduled_for,
            started_at, paused_at, ended_at, total_elapsed_seconds, active_elapsed_seconds, break_elapsed_seconds,
            goal_summary, goal_specific, goal_measurable, goal_achievable, goal_relevant, goal_time_bound,
            expected_output, outcome_summary, reflection_summary, success_criteria_met,
            notes_markdown_path, reflection_markdown_path,
            toggl_workspace_id, toggl_project_id, toggl_time_entry_id, last_toggl_sync_at, toggl_sync_status,
            tags
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
        "#
    )
    .bind(&new_id)
    .bind(&input.title)
    .bind(&new_slug)
    .bind("planned")
    .bind(now.to_rfc3339())
    .bind(None::<String>)  // scheduled_for
    .bind(None::<String>)  // started_at
    .bind(None::<String>)  // paused_at
    .bind(None::<String>)  // ended_at
    .bind(0i64)  // total_elapsed_seconds
    .bind(0i64)  // active_elapsed_seconds
    .bind(0i64)  // break_elapsed_seconds
    .bind(&input.goal_summary)
    .bind(&input.goal_specific)
    .bind(&input.goal_measurable)
    .bind(&input.goal_achievable)
    .bind(&input.goal_relevant)
    .bind(&input.goal_time_bound)
    .bind(&input.expected_output)
    .bind(None::<String>)  // outcome_summary (reset)
    .bind(None::<String>)  // reflection_summary (reset)
    .bind(None::<i64>)     // success_criteria_met (reset)
    .bind(&new_notes_path)
    .bind(None::<String>)  // reflection_markdown_path
    .bind(None::<String>)  // toggl_workspace_id (reset)
    .bind(None::<String>)  // toggl_project_id (reset)
    .bind(None::<String>)  // toggl_time_entry_id (reset)
    .bind(None::<String>)  // last_toggl_sync_at (reset)
    .bind(None::<String>)  // toggl_sync_status (reset)
    .bind(tags_json)
    .execute(&pool)
    .await?;

    // 7. Copy link attachments (not file attachments)
    let attachments: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT type, label, url FROM attachments WHERE session_id = ?1"
    )
    .bind(&source_session_id)
    .fetch_all(&pool)
    .await?;

    for (type_, label, url) in attachments {
        if type_ == "link" {
            let attachment_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO attachments (id, session_id, type, label, file_path, url, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
            )
            .bind(&attachment_id)
            .bind(&new_id)
            .bind(&type_)
            .bind(&label)
            .bind(None::<String>)
            .bind(&url)
            .bind(now.to_rfc3339())
            .execute(&pool)
            .await?;
        }
    }

    // 8. Return the new session
    get_session_by_id(&app, &new_id).await.ok_or_else(|| NotaError::NotFound("Session not found".to_string()))
}

#[tauri::command]
pub async fn create_session(app: AppHandle, input: CreateSessionInput) -> Result<Session> {
    let pool = db::get_db_pool(&app)?;
    let now = Utc::now();

    let id = format!("sess_{}", uuid::Uuid::new_v4().simple());
    let slug = format!(
        "{}_{}",
        now.format("%Y%m%d_%H%M%S"),
        slug::slugify(&input.title).replace("-", "_")
    );

    let tags_json = input.tags.map(|t| serde_json::to_string(&t).unwrap_or_default());

    sqlx::query(
        r#"
        INSERT INTO sessions (
            id, title, slug, status, created_at, updated_at, scheduled_for,
            goal_summary, goal_specific, goal_measurable, goal_achievable, goal_relevant, goal_time_bound,
            expected_output, notes_markdown_path, tags
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
        "#
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&slug)
    .bind("planned")
    .bind(now.to_rfc3339())
    .bind(input.scheduled_for.map(|d| d.to_rfc3339()))
    .bind(&input.goal_summary)
    .bind(&input.goal_specific)
    .bind(&input.goal_measurable)
    .bind(&input.goal_achievable)
    .bind(&input.goal_relevant)
    .bind(&input.goal_time_bound)
    .bind(&input.expected_output)
    .bind(format!("sessions/{}/notes.md", slug))
    .bind(tags_json)
    .execute(&pool)
    .await?;

    get_session_by_id(&app, &id).await.ok_or_else(|| NotaError::NotFound("Session not found".to_string()))
}

#[tauri::command]
pub async fn get_sessions(app: AppHandle) -> Result<Vec<Session>> {
    let pool = db::get_db_pool(&app)?;

    let rows = sqlx::query_as::<_, SessionRow>(
        "SELECT * FROM sessions ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    let sessions: Vec<Session> = rows
        .into_iter()
        .map(|r| r.into())
        .collect();

    Ok(sessions)
}

async fn get_session_by_id(app: &AppHandle, id: &str) -> Option<Session> {
    let pool = db::get_db_pool(app).ok()?;

    let row = sqlx::query_as::<_, SessionRow>("SELECT * FROM sessions WHERE id = ?1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .ok()?;

    row.map(|r| r.into())
}

#[tauri::command]
pub async fn update_session(app: AppHandle, id: String, input: UpdateSessionInput) -> Result<Session> {
    let pool = db::get_db_pool(&app)?;
    let now = Utc::now();

    let mut updates = vec![];

    if let Some(title) = &input.title {
        updates.push(format!("title = '{}'", title.replace("'", "''")));
    }
    if let Some(status) = &input.status {
        updates.push(format!("status = '{}'", status.to_string()));
    }
    if let Some(started_at) = input.started_at {
        updates.push(format!("started_at = '{}'", started_at.to_rfc3339()));
    }
    if let Some(paused_at) = input.paused_at {
        updates.push(format!("paused_at = '{}'", paused_at.to_rfc3339()));
    }
    if let Some(ended_at) = input.ended_at {
        updates.push(format!("ended_at = '{}'", ended_at.to_rfc3339()));
    }
    if let Some(active_elapsed) = input.active_elapsed_seconds {
        updates.push(format!("active_elapsed_seconds = {}", active_elapsed));
    }

    if !updates.is_empty() {
        let query = format!(
            "UPDATE sessions SET {}, updated_at = '{}' WHERE id = '{}'",
            updates.join(", "),
            now.to_rfc3339(),
            id.replace("'", "''")
        );

        sqlx::query(&query)
            .execute(&pool)
            .await?;
    }

    get_session_by_id(&app, &id).await.ok_or_else(|| NotaError::NotFound("Session not found".to_string()))
}

#[tauri::command]
pub async fn delete_session(app: AppHandle, id: String) -> Result<()> {
    let pool = db::get_db_pool(&app)?;

    // Clear timer_state if it references this session to avoid FK constraint failure
    sqlx::query(
        "UPDATE timer_state SET active_session_id = NULL, state = 'idle', accumulated_seconds = 0, started_at = NULL, paused_at = NULL, updated_at = ?1
         WHERE active_session_id = ?2"
    )
    .bind(Utc::now().to_rfc3339())
    .bind(&id)
    .execute(&pool)
    .await?;

    sqlx::query("DELETE FROM sessions WHERE id = ?1")
        .bind(&id)
        .execute(&pool)
        .await?;

    Ok(())
}

/// Increment copy suffix for duplicate titles
/// "Chapter 1" -> "Chapter 2" (if number at end)
/// "Notes" -> "Notes (Copy)"
/// "Notes (Copy)" -> "Notes (Copy 2)"
/// "Notes (Copy 2)" -> "Notes (Copy 3)"
fn increment_copy_suffix(title: &str) -> String {
    // Check for "(Copy N)" pattern at the end
    let copy_pattern = regex::Regex::new(r"^(.*)\s*\(Copy\s*(\d+)\)$").unwrap();
    if let Some(captures) = copy_pattern.captures(title) {
        let base = captures.get(1).unwrap().as_str().trim();
        let num: i32 = captures.get(2).unwrap().as_str().parse().unwrap_or(1);
        return format!("{} (Copy {})", base, num + 1);
    }

    // Check for "(Copy)" pattern
    if title.ends_with(" (Copy)") {
        let base = &title[..title.len() - 7];
        return format!("{} (Copy 2)", base);
    }

    // Check for number at the end (e.g., "Chapter 1", "Part 2")
    let num_pattern = regex::Regex::new(r"^(.*?)(\d+)\s*$").unwrap();
    if let Some(captures) = num_pattern.captures(title) {
        let base = captures.get(1).unwrap().as_str();
        let num: i32 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
        // Only increment if it's a reasonable chapter/part number (not a year like "2024")
        if num < 1000 {
            return format!("{}{}", base, num + 1);
        }
    }

    // Default: add "(Copy)"
    format!("{} (Copy)", title)
}

#[tauri::command]
pub async fn duplicate_session(app: AppHandle, session_id: String) -> Result<Session> {
    let pool = db::get_db_pool(&app)?;
    let now = Utc::now();

    // 1. Fetch source session
    let source_row: SessionRow = sqlx::query_as::<_, SessionRow>(
        "SELECT * FROM sessions WHERE id = ?1"
    )
    .bind(&session_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| NotaError::NotFound("Session not found".to_string()))?;

    // 2. Generate new session ID and slug
    let new_id = format!("sess_{}", uuid::Uuid::new_v4().simple());
    let new_title = increment_copy_suffix(&source_row.title);
    let new_slug = format!(
        "{}_{}",
        now.format("%Y%m%d_%H%M%S"),
        slug::slugify(&new_title).replace("-", "_")
    );

    // 3. Create new notes file path
    let new_notes_path = format!("sessions/{}/notes.md", new_slug);

    // 4. Copy notes file content if it exists
    let sessions_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?
        .join("sessions");

    let source_notes_file = sessions_dir.join(&source_row.notes_markdown_path);
    if source_notes_file.exists() {
        let new_notes_file = sessions_dir.join(&new_notes_path);

        // Create parent directory
        if let Some(parent) = new_notes_file.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| NotaError::FileSystem(e.to_string()))?;
        }

        // Copy file content
        let content = tokio::fs::read_to_string(&source_notes_file)
            .await
            .map_err(|e| NotaError::FileSystem(e.to_string()))?;

        tokio::fs::write(&new_notes_file, content)
            .await
            .map_err(|e| NotaError::FileSystem(e.to_string()))?;
    }

    // 5. Insert new session (reset timing, status, sync data)
    sqlx::query(
        r#"
        INSERT INTO sessions (
            id, title, slug, status, created_at, updated_at, scheduled_for,
            started_at, paused_at, ended_at, total_elapsed_seconds, active_elapsed_seconds, break_elapsed_seconds,
            goal_summary, goal_specific, goal_measurable, goal_achievable, goal_relevant, goal_time_bound,
            expected_output, outcome_summary, reflection_summary, success_criteria_met,
            notes_markdown_path, reflection_markdown_path,
            toggl_workspace_id, toggl_project_id, toggl_time_entry_id, last_toggl_sync_at, toggl_sync_status,
            tags
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
        "#
    )
    .bind(&new_id)
    .bind(&new_title)
    .bind(&new_slug)
    .bind("planned")  // Always start as planned
    .bind(now.to_rfc3339())
    .bind(None::<String>)  // scheduled_for
    .bind(None::<String>)  // started_at
    .bind(None::<String>)  // paused_at
    .bind(None::<String>)  // ended_at
    .bind(0i64)  // total_elapsed_seconds
    .bind(0i64)  // active_elapsed_seconds
    .bind(0i64)  // break_elapsed_seconds
    .bind(&source_row.goal_summary)
    .bind(&source_row.goal_specific)
    .bind(&source_row.goal_measurable)
    .bind(&source_row.goal_achievable)
    .bind(&source_row.goal_relevant)
    .bind(&source_row.goal_time_bound)
    .bind(&source_row.expected_output)
    .bind(None::<String>)  // outcome_summary (reset)
    .bind(None::<String>)  // reflection_summary (reset)
    .bind(None::<i64>)     // success_criteria_met (reset)
    .bind(&new_notes_path)
    .bind(None::<String>)  // reflection_markdown_path
    .bind(None::<String>)  // toggl_workspace_id (reset)
    .bind(None::<String>)  // toggl_project_id (reset)
    .bind(None::<String>)  // toggl_time_entry_id (reset)
    .bind(None::<String>)  // last_toggl_sync_at (reset)
    .bind(None::<String>)  // toggl_sync_status (reset)
    .bind(&source_row.tags)
    .execute(&pool)
    .await?;

    // 6. Copy attachments (only link attachments - file attachments reference existing files)
    let attachments: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT type, label, url FROM attachments WHERE session_id = ?1"
    )
    .bind(&session_id)
    .fetch_all(&pool)
    .await?;

    for (type_, label, url) in attachments {
        let attachment_id = uuid::Uuid::new_v4().to_string();

        // Only copy link attachments (not file attachments - they reference specific files)
        if type_ == "link" {
            sqlx::query(
                "INSERT INTO attachments (id, session_id, type, label, file_path, url, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
            )
            .bind(&attachment_id)
            .bind(&new_id)
            .bind(&type_)
            .bind(&label)
            .bind(None::<String>)  // file_path
            .bind(&url)
            .bind(now.to_rfc3339())
            .execute(&pool)
            .await?;
        }
        // Note: File attachments are NOT copied - they reference specific files that were
        // copied to the app's attachment directory. The user can add them manually if needed.
    }

    // 7. Return the new session
    get_session_by_id(&app, &new_id).await.ok_or_else(|| NotaError::NotFound("Session not found".to_string()))
}

// Database row representation
#[derive(sqlx::FromRow)]
struct SessionRow {
    id: String,
    title: String,
    slug: String,
    status: String,
    created_at: String,
    updated_at: String,
    scheduled_for: Option<String>,
    started_at: Option<String>,
    paused_at: Option<String>,
    ended_at: Option<String>,
    total_elapsed_seconds: i64,
    active_elapsed_seconds: i64,
    break_elapsed_seconds: i64,
    goal_summary: Option<String>,
    goal_specific: Option<String>,
    goal_measurable: Option<String>,
    goal_achievable: Option<String>,
    goal_relevant: Option<String>,
    goal_time_bound: Option<String>,
    expected_output: Option<String>,
    outcome_summary: Option<String>,
    reflection_summary: Option<String>,
    success_criteria_met: Option<i64>,
    notes_markdown_path: String,
    reflection_markdown_path: Option<String>,
    toggl_workspace_id: Option<String>,
    toggl_project_id: Option<String>,
    toggl_time_entry_id: Option<String>,
    last_toggl_sync_at: Option<String>,
    toggl_sync_status: Option<String>,
    tags: Option<String>,
}

impl From<SessionRow> for Session {
    fn from(r: SessionRow) -> Self {
        fn parse_datetime(s: &str) -> chrono::DateTime<Utc> {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now())
        }

        Session {
            id: r.id,
            title: r.title,
            slug: r.slug,
            status: r.status.into(),
            created_at: parse_datetime(&r.created_at),
            updated_at: parse_datetime(&r.updated_at),
            scheduled_for: r.scheduled_for.map(|s| parse_datetime(&s)),
            started_at: r.started_at.map(|s| parse_datetime(&s)),
            paused_at: r.paused_at.map(|s| parse_datetime(&s)),
            ended_at: r.ended_at.map(|s| parse_datetime(&s)),
            total_elapsed_seconds: r.total_elapsed_seconds,
            active_elapsed_seconds: r.active_elapsed_seconds,
            break_elapsed_seconds: r.break_elapsed_seconds,
            goal_summary: r.goal_summary,
            goal_specific: r.goal_specific,
            goal_measurable: r.goal_measurable,
            goal_achievable: r.goal_achievable,
            goal_relevant: r.goal_relevant,
            goal_time_bound: r.goal_time_bound,
            expected_output: r.expected_output,
            outcome_summary: r.outcome_summary,
            reflection_summary: r.reflection_summary,
            success_criteria_met: r.success_criteria_met,
            notes_markdown_path: r.notes_markdown_path,
            reflection_markdown_path: r.reflection_markdown_path,
            toggl_workspace_id: r.toggl_workspace_id,
            toggl_project_id: r.toggl_project_id,
            toggl_time_entry_id: r.toggl_time_entry_id,
            last_toggl_sync_at: r.last_toggl_sync_at.map(|s| parse_datetime(&s)),
            toggl_sync_status: r.toggl_sync_status,
            tags: r.tags,
        }
    }
}
