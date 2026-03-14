use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::{NotaError, Result};

fn get_sessions_dir(app: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    let sessions_dir = app_data_dir.join("sessions");
    std::fs::create_dir_all(&sessions_dir)
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    Ok(sessions_dir)
}

#[tauri::command]
pub async fn read_markdown_file(app: AppHandle, relative_path: String) -> Result<String> {
    let sessions_dir = get_sessions_dir(&app)?;
    let file_path = sessions_dir.join(&relative_path);

    // Security check: ensure path is within sessions directory
    if !file_path.starts_with(&sessions_dir) {
        return Err(NotaError::Validation("Invalid path".to_string()));
    }

    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    Ok(content)
}

#[tauri::command]
pub async fn write_markdown_file(
    app: AppHandle,
    relative_path: String,
    content: String,
) -> Result<()> {
    let sessions_dir = get_sessions_dir(&app)?;
    let file_path = sessions_dir.join(&relative_path);

    // Security check
    if !file_path.starts_with(&sessions_dir) {
        return Err(NotaError::Validation("Invalid path".to_string()));
    }

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| NotaError::FileSystem(e.to_string()))?;
    }

    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    Ok(())
}
