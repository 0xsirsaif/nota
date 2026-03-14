use chrono::Utc;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::db;
use crate::error::Result;
use crate::models::timer::*;

#[tauri::command]
pub async fn get_timer_state(app: AppHandle) -> Result<TimerStatus> {
    let pool = db::get_db_pool(&app)?;

    let row: Option<TimerRow> = sqlx::query_as(
        "SELECT active_session_id, state, accumulated_seconds, started_at FROM timer_state WHERE id = 1"
    )
    .fetch_optional(&pool)
    .await?;

    if let Some(row) = row {
        let is_active = row.state == "running";
        let elapsed = if is_active && row.started_at.is_some() {
            // Calculate elapsed time including time since last tick
            let started = chrono::DateTime::parse_from_rfc3339(&row.started_at.unwrap())
                .map_err(|e| crate::error::NotaError::Validation(e.to_string()))?
                .with_timezone(&Utc);
            let paused_duration = row.accumulated_seconds;
            let current_duration = (Utc::now() - started).num_seconds();
            paused_duration + current_duration
        } else {
            row.accumulated_seconds
        };

        Ok(TimerStatus {
            session_id: row.active_session_id,
            state: row.state.into(),
            elapsed_seconds: elapsed.max(0) as i64,
            is_active,
        })
    } else {
        Ok(TimerStatus {
            session_id: None,
            state: TimerState::Idle,
            elapsed_seconds: 0,
            is_active: false,
        })
    }
}

#[tauri::command]
pub async fn update_timer_state(
    app: AppHandle,
    session_id: Option<String>,
    state: String,
    accumulated_seconds: i64,
) -> Result<()> {
    let pool = db::get_db_pool(&app)?;

    let started_at = if state == "running" {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };

    let paused_at = if state == "paused" {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };

    sqlx::query(
        "INSERT INTO timer_state (id, active_session_id, state, accumulated_seconds, started_at, paused_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
         active_session_id = excluded.active_session_id,
         state = excluded.state,
         accumulated_seconds = excluded.accumulated_seconds,
         started_at = excluded.started_at,
         paused_at = excluded.paused_at,
         updated_at = excluded.updated_at"
    )
    .bind(session_id)
    .bind(&state)
    .bind(accumulated_seconds)
    .bind(started_at)
    .bind(paused_at)
    .bind(Utc::now().to_rfc3339())
    .execute(&pool)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn send_timer_notification(app: AppHandle, title: String, body: String) -> Result<()> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| crate::error::NotaError::Notification(e.to_string()))?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct TimerRow {
    active_session_id: Option<String>,
    state: String,
    accumulated_seconds: i64,
    started_at: Option<String>,
}
