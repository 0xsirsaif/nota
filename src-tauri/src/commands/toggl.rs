use chrono::Utc;
use tauri::AppHandle;

use crate::db;
use crate::error::{NotaError, Result};

const TOGGL_API_BASE: &str = "https://api.track.toggl.com/api/v9";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TogglWorkspace {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TogglProject {
    pub id: i64,
    pub name: String,
    pub workspace_id: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TogglTimeEntry {
    pub id: i64,
    pub description: String,
    pub start: String,
    pub stop: Option<String>,
    pub duration: i64,
    pub workspace_id: i64,
    pub project_id: Option<i64>,
}

/// Get Toggl API token from settings
async fn get_api_token(app: &AppHandle) -> Result<String> {
    let pool = db::get_db_pool(app)?;

    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = 'toggl_api_token'"
    )
    .fetch_optional(&pool)
    .await?;

    match row {
        Some((token,)) if !token.is_empty() => Ok(token),
        _ => Err(NotaError::Validation("Toggl API token not configured".to_string())),
    }
}

/// Make authenticated request to Toggl API
async fn toggl_request(
    api_token: &str,
    method: reqwest::Method,
    endpoint: &str,
    body: Option<serde_json::Value>,
) -> Result<reqwest::Response> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", TOGGL_API_BASE, endpoint);

    let mut request = client
        .request(method, &url)
        .basic_auth(api_token, Some("api_token"));

    if let Some(json_body) = body {
        request = request
            .header("Content-Type", "application/json")
            .json(&json_body);
    }

    let response = request
        .send()
        .await
        .map_err(|e| NotaError::Internal(format!("HTTP request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(NotaError::Internal(format!(
            "Toggl API error ({}): {}",
            status, text
        )));
    }

    Ok(response)
}

#[tauri::command]
pub async fn toggl_validate_token(app: AppHandle, api_token: String) -> Result<bool> {
    let response = toggl_request(&api_token, reqwest::Method::GET, "/me", None).await;

    match response {
        Ok(_) => {
            // Save the token if valid
            let pool = db::get_db_pool(&app)?;
            sqlx::query(
                "INSERT INTO settings (key, value, updated_at) VALUES ('toggl_api_token', ?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
            )
            .bind(&api_token)
            .bind(Utc::now().to_rfc3339())
            .execute(&pool)
            .await?;

            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn toggl_get_workspaces(app: AppHandle) -> Result<Vec<TogglWorkspace>> {
    let api_token = get_api_token(&app).await?;

    let response = toggl_request(&api_token, reqwest::Method::GET, "/workspaces", None).await?;

    let workspaces: Vec<TogglWorkspace> = response
        .json()
        .await
        .map_err(|e| NotaError::Internal(format!("Failed to parse response: {}", e)))?;

    Ok(workspaces)
}

#[tauri::command]
pub async fn toggl_get_projects(app: AppHandle, workspace_id: i64) -> Result<Vec<TogglProject>> {
    let api_token = get_api_token(&app).await?;

    let endpoint = format!("/workspaces/{}/projects", workspace_id);
    let response = toggl_request(&api_token, reqwest::Method::GET, &endpoint, None).await?;

    let projects: Vec<TogglProject> = response
        .json()
        .await
        .map_err(|e| NotaError::Internal(format!("Failed to parse response: {}", e)))?;

    Ok(projects)
}

#[tauri::command]
pub async fn toggl_create_time_entry(
    app: AppHandle,
    session_id: String,
    workspace_id: i64,
    project_id: Option<i64>,
    description: String,
    start_time: String,
    duration_seconds: i64,
) -> Result<TogglTimeEntry> {
    let api_token = get_api_token(&app).await?;
    let pool = db::get_db_pool(&app)?;

    // Check if already synced
    let existing: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT toggl_time_entry_id FROM sessions WHERE id = ?1"
    )
    .bind(&session_id)
    .fetch_optional(&pool)
    .await?;

    if let Some((Some(entry_id),)) = existing {
        if !entry_id.is_empty() {
            return Err(NotaError::Validation(
                format!("Session already synced with Toggl entry {}", entry_id)
            ));
        }
    }

    // Parse start time and calculate stop time
    // If start_time is empty or invalid, use current time minus duration
    let start = if start_time.is_empty() {
        Utc::now() - chrono::Duration::seconds(duration_seconds)
    } else {
        chrono::DateTime::parse_from_rfc3339(&start_time)
            .map_err(|_| NotaError::Validation(format!("Invalid start time format: {}", start_time)))?
            .with_timezone(&Utc)
    };

    let stop = start + chrono::Duration::seconds(duration_seconds);

    let body = serde_json::json!({
        "description": description,
        "start": start.to_rfc3339(),
        "stop": stop.to_rfc3339(),
        "duration": duration_seconds,
        "workspace_id": workspace_id,
        "project_id": project_id,
        "created_with": "Nota Study App",
    });

    let response = toggl_request(
        &api_token,
        reqwest::Method::POST,
        &format!("/workspaces/{}/time_entries", workspace_id),
        Some(body),
    ).await?;

    let entry: TogglTimeEntry = response
        .json()
        .await
        .map_err(|e| NotaError::Internal(format!("Failed to parse response: {}", e)))?;

    // Update session with Toggl info
    sqlx::query(
        "UPDATE sessions SET
         toggl_workspace_id = ?1,
         toggl_project_id = ?2,
         toggl_time_entry_id = ?3,
         last_toggl_sync_at = ?4,
         toggl_sync_status = 'synced'
         WHERE id = ?5"
    )
    .bind(workspace_id.to_string())
    .bind(project_id.map(|p| p.to_string()))
    .bind(entry.id.to_string())
    .bind(Utc::now().to_rfc3339())
    .bind(&session_id)
    .execute(&pool)
    .await?;

    Ok(entry)
}

#[tauri::command]
pub async fn toggl_disconnect(app: AppHandle) -> Result<()> {
    let pool = db::get_db_pool(&app)?;

    sqlx::query("DELETE FROM settings WHERE key = 'toggl_api_token'")
        .execute(&pool)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn toggl_get_sync_status(app: AppHandle, session_id: String) -> Result<serde_json::Value> {
    let pool = db::get_db_pool(&app)?;

    let row: Option<(Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT toggl_time_entry_id, last_toggl_sync_at, toggl_sync_status, toggl_workspace_id
         FROM sessions WHERE id = ?1"
    )
    .bind(&session_id)
    .fetch_optional(&pool)
    .await?;

    match row {
        Some((entry_id, synced_at, status, workspace_id)) => {
            Ok(serde_json::json!({
                "synced": entry_id.is_some() && !entry_id.as_ref().unwrap().is_empty(),
                "time_entry_id": entry_id,
                "last_sync": synced_at,
                "status": status.unwrap_or_else(|| "not_synced".to_string()),
                "workspace_id": workspace_id,
            }))
        }
        None => Err(NotaError::NotFound("Session not found".to_string())),
    }
}
