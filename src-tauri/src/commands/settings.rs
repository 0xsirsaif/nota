use chrono::Utc;
use tauri::AppHandle;

use crate::db;
use crate::error::Result;

#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<Option<String>> {
    let pool = db::get_db_pool(&app)?;

    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?1")
        .bind(&key)
        .fetch_optional(&pool)
        .await?;

    Ok(row.map(|r| r.0))
}

#[tauri::command]
pub async fn set_setting(app: AppHandle, key: String, value: String) -> Result<()> {
    let pool = db::get_db_pool(&app)?;
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3"
    )
    .bind(&key)
    .bind(&value)
    .bind(&now)
    .execute(&pool)
    .await?;

    Ok(())
}
