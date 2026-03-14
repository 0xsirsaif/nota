use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use walkdir::WalkDir;
use zip::write::FileOptions;
use std::io::Write;

use crate::db;
use crate::error::{NotaError, Result};

const EXPORT_VERSION: &str = "1.0.0";
const MANIFEST_FILENAME: &str = "manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportManifest {
    pub version: String,
    pub nota_version: String,
    pub exported_at: DateTime<Utc>,
    pub export_type: ExportType,
    pub stats: ExportStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportType {
    Full,
    SessionsOnly,
    NotesOnly,
}

impl ToString for ExportType {
    fn to_string(&self) -> String {
        match self {
            ExportType::Full => "full".to_string(),
            ExportType::SessionsOnly => "sessions_only".to_string(),
            ExportType::NotesOnly => "notes_only".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportStats {
    pub session_count: u64,
    pub note_file_count: u64,
    pub attachment_count: u64,
    pub total_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub export_type: ExportType,
    pub include_attachments: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub path: String,
    pub stats: ExportStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub operation_id: String,
    pub percent: u8,
    pub current_file: String,
    pub processed: u64,
    pub total: u64,
    pub phase: String,
}

#[tauri::command]
pub async fn export_full_backup(
    app: AppHandle,
    destination_path: String,
) -> Result<ExportResult> {
    let operation_id = format!("export_{}", uuid::Uuid::new_v4().simple());
    let dest_path = Path::new(&destination_path);

    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| {
            NotaError::FileSystem(format!("Failed to create destination directory: {}", e))
        })?;
    }

    // Create temp directory for staging
    let temp_dir = tempfile::tempdir().map_err(|e| {
        NotaError::Internal(format!("Failed to create temp directory: {}", e))
    })?;
    let temp_path = temp_dir.path();

    emit_progress(
        &app, &operation_id, 0, "", 0, 0, "Starting export...",
    );

    // Get database pool
    let pool = db::get_db_pool(&app)?;

    // Export sessions to JSON
    emit_progress(
        &app, &operation_id, 5, "", 0, 0, "Exporting sessions...",
    );
    let sessions = export_sessions_to_json(&pool, temp_path).await?;
    let session_count = sessions.len() as u64;

    // Export settings
    emit_progress(
        &app, &operation_id, 10, "", 0, 0, "Exporting settings...",
    );
    export_settings_to_json(&pool, temp_path).await?;

    // Export timer state
    emit_progress(
        &app, &operation_id, 15, "", 0, 0, "Exporting timer state...",
    );
    export_timer_state_to_json(&pool, temp_path).await?;

    // Copy notes directory
    emit_progress(
        &app, &operation_id, 20, "", 0, 0, "Copying notes...",
    );
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;
    let notes_dir = app_data_dir.join("sessions");
    let note_file_count = if notes_dir.exists() {
        copy_notes_directory(&notes_dir, &temp_path.join("notes")).await?
    } else {
        0
    };

    // Copy attachments
    emit_progress(
        &app, &operation_id, 60, "", 0, 0, "Copying attachments...",
    );
    let attachments_dir = app_data_dir.join("attachments");
    let attachment_count = if attachments_dir.exists() {
        copy_attachments_directory(&attachments_dir, &temp_path.join("attachments")).await?
    } else {
        0
    };

    // Create manifest
    let manifest = ExportManifest {
        version: EXPORT_VERSION.to_string(),
        nota_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: Utc::now(),
        export_type: ExportType::Full,
        stats: ExportStats {
            session_count,
            note_file_count,
            attachment_count,
            total_size_bytes: 0, // Will be updated after compression
        },
    };

    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| {
        NotaError::Internal(format!("Failed to serialize manifest: {}", e))
    })?;
    fs::write(temp_path.join(MANIFEST_FILENAME), manifest_json).await
        .map_err(|e| NotaError::FileSystem(format!("Failed to write manifest: {}", e)))?;

    // Create ZIP archive
    emit_progress(
        &app, &operation_id, 80, "", 0, 0, "Creating archive...",
    );
    create_zip_archive(temp_path, dest_path, &app, &operation_id).await?;

    // Get final file size
    let total_size_bytes = fs::metadata(dest_path).await
        .map(|m| m.len())
        .unwrap_or(0);

    emit_progress(
        &app, &operation_id, 100, "", 0, 0, "Export complete!",
    );

    Ok(ExportResult {
        path: destination_path,
        stats: ExportStats {
            session_count,
            note_file_count,
            attachment_count,
            total_size_bytes,
        },
    })
}

// Session row structure for export
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

async fn export_sessions_to_json(pool: &sqlx::SqlitePool, temp_path: &Path) -> Result<Vec<serde_json::Value>> {
    let rows = sqlx::query_as::<_, SessionRow>(
        "SELECT * FROM sessions ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;

    let sessions: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.id,
                "title": row.title,
                "slug": row.slug,
                "status": row.status,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "scheduled_for": row.scheduled_for,
                "started_at": row.started_at,
                "paused_at": row.paused_at,
                "ended_at": row.ended_at,
                "total_elapsed_seconds": row.total_elapsed_seconds,
                "active_elapsed_seconds": row.active_elapsed_seconds,
                "break_elapsed_seconds": row.break_elapsed_seconds,
                "goal_summary": row.goal_summary,
                "goal_specific": row.goal_specific,
                "goal_measurable": row.goal_measurable,
                "goal_achievable": row.goal_achievable,
                "goal_relevant": row.goal_relevant,
                "goal_time_bound": row.goal_time_bound,
                "expected_output": row.expected_output,
                "outcome_summary": row.outcome_summary,
                "reflection_summary": row.reflection_summary,
                "success_criteria_met": row.success_criteria_met,
                "notes_markdown_path": row.notes_markdown_path,
                "reflection_markdown_path": row.reflection_markdown_path,
                "toggl_workspace_id": row.toggl_workspace_id,
                "toggl_project_id": row.toggl_project_id,
                "toggl_time_entry_id": row.toggl_time_entry_id,
                "last_toggl_sync_at": row.last_toggl_sync_at,
                "toggl_sync_status": row.toggl_sync_status,
                "tags": row.tags,
            })
        })
        .collect();

    let db_dir = temp_path.join("database");
    fs::create_dir_all(&db_dir).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to create database dir: {}", e))
    })?;

    let json = serde_json::to_string_pretty(&sessions).map_err(|e| {
        NotaError::Internal(format!("Failed to serialize sessions: {}", e))
    })?;
    fs::write(db_dir.join("sessions.json"), json).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to write sessions.json: {}", e))
    })?;

    Ok(sessions)
}

async fn export_settings_to_json(pool: &sqlx::SqlitePool, temp_path: &Path) -> Result<()> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM settings"
    )
    .fetch_all(pool)
    .await?;

    let settings: serde_json::Value = rows
        .into_iter()
        .map(|(key, value)| {
            (key, serde_json::Value::String(value))
        })
        .collect::<serde_json::Map<String, serde_json::Value>>()
        .into();

    let db_dir = temp_path.join("database");
    fs::create_dir_all(&db_dir).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to create database dir: {}", e))
    })?;

    let json = serde_json::to_string_pretty(&settings).map_err(|e| {
        NotaError::Internal(format!("Failed to serialize settings: {}", e))
    })?;
    fs::write(db_dir.join("settings.json"), json).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to write settings.json: {}", e))
    })?;

    Ok(())
}

async fn export_timer_state_to_json(pool: &sqlx::SqlitePool, temp_path: &Path) -> Result<()> {
    let row = sqlx::query_as::<_, (
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        Option<String>,
        Option<String>,
    )>(
        "SELECT active_session_id, state, last_tick_at, accumulated_seconds, started_at, paused_at FROM timer_state WHERE id = 1"
    )
    .fetch_optional(pool)
    .await?;

    if let Some((session_id, state, last_tick, accumulated, started, paused)) = row {
        let timer_state = serde_json::json!({
            "active_session_id": session_id,
            "state": state,
            "last_tick_at": last_tick,
            "accumulated_seconds": accumulated,
            "started_at": started,
            "paused_at": paused,
        });

        let db_dir = temp_path.join("database");
        fs::create_dir_all(&db_dir).await.map_err(|e| {
            NotaError::FileSystem(format!("Failed to create database dir: {}", e))
        })?;

        let json = serde_json::to_string_pretty(&timer_state).map_err(|e| {
            NotaError::Internal(format!("Failed to serialize timer state: {}", e))
        })?;
        fs::write(db_dir.join("timer_state.json"), json).await.map_err(|e| {
            NotaError::FileSystem(format!("Failed to write timer_state.json: {}", e))
        })?;
    }

    Ok(())
}

async fn copy_notes_directory(source: &Path, dest: &Path) -> Result<u64> {
    let mut count = 0u64;

    if !source.exists() {
        return Ok(0);
    }

    fs::create_dir_all(&dest).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to create notes dir: {}", e))
    })?;

    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|e| {
            NotaError::FileSystem(format!("WalkDir error: {}", e))
        })?;

        let src_path = entry.path();
        let relative_path = src_path.strip_prefix(source).map_err(|e| {
            NotaError::Internal(format!("Path strip error: {}", e))
        })?;
        let dst_path = dest.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&dst_path).await.map_err(|e| {
                NotaError::FileSystem(format!("Failed to create dir: {}", e))
            })?;
        } else {
            fs::copy(src_path, &dst_path).await.map_err(|e| {
                NotaError::FileSystem(format!("Failed to copy file: {}", e))
            })?;
            count += 1;
        }
    }

    Ok(count)
}

async fn copy_attachments_directory(source: &Path, dest: &Path) -> Result<u64> {
    let mut count = 0u64;

    if !source.exists() {
        return Ok(0);
    }

    fs::create_dir_all(&dest).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to create attachments dir: {}", e))
    })?;

    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|e| {
            NotaError::FileSystem(format!("WalkDir error: {}", e))
        })?;

        let src_path = entry.path();
        let relative_path = src_path.strip_prefix(source).map_err(|e| {
            NotaError::Internal(format!("Path strip error: {}", e))
        })?;
        let dst_path = dest.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&dst_path).await.map_err(|e| {
                NotaError::FileSystem(format!("Failed to create dir: {}", e))
            })?;
        } else {
            fs::copy(src_path, &dst_path).await.map_err(|e| {
                NotaError::FileSystem(format!("Failed to copy file: {}", e))
            })?;
            count += 1;
        }
    }

    Ok(count)
}

async fn create_zip_archive(
    source_dir: &Path,
    dest_file: &Path,
    app: &AppHandle,
    operation_id: &str,
) -> Result<()> {
    let file = std::fs::File::create(dest_file).map_err(|e| {
        NotaError::FileSystem(format!("Failed to create ZIP file: {}", e))
    })?;

    let mut zip = zip::ZipWriter::new(file);
    let options: FileOptions<()> = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut buffer = Vec::new();
    let total_files = WalkDir::new(source_dir).into_iter().filter_map(|e| e.ok()).count() as u64;
    let mut processed = 0u64;

    for entry in WalkDir::new(source_dir).min_depth(1) {
        let entry = entry.map_err(|e| {
            NotaError::FileSystem(format!("WalkDir error: {}", e))
        })?;

        let path = entry.path();
        let relative_path = path.strip_prefix(source_dir).map_err(|e| {
            NotaError::Internal(format!("Path strip error: {}", e))
        })?;
        let name = relative_path.to_string_lossy();

        if entry.file_type().is_file() {
            emit_progress(
                app,
                operation_id,
                80 + (15.0 * processed as f64 / total_files.max(1) as f64) as u8,
                &name,
                processed,
                total_files,
                "Compressing...",
            );

            zip.start_file(name, options).map_err(|e| {
                NotaError::FileSystem(format!("Failed to start ZIP file: {}", e))
            })?;

            let mut f = std::fs::File::open(path).map_err(|e| {
                NotaError::FileSystem(format!("Failed to open file: {}", e))
            })?;
            std::io::Read::read_to_end(&mut f, &mut buffer).map_err(|e| {
                NotaError::FileSystem(format!("Failed to read file: {}", e))
            })?;
            zip.write_all(&buffer).map_err(|e| {
                NotaError::FileSystem(format!("Failed to write to ZIP: {}", e))
            })?;
            buffer.clear();
            processed += 1;
        } else if entry.file_type().is_dir() {
            zip.add_directory(name, options).map_err(|e| {
                NotaError::FileSystem(format!("Failed to add directory to ZIP: {}", e))
            })?;
        }
    }

    zip.finish().map_err(|e| {
        NotaError::FileSystem(format!("Failed to finalize ZIP: {}", e))
    })?;

    Ok(())
}

fn emit_progress(
    app: &AppHandle,
    operation_id: &str,
    percent: u8,
    current_file: &str,
    processed: u64,
    total: u64,
    phase: &str,
) {
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            operation_id: operation_id.to_string(),
            percent,
            current_file: current_file.to_string(),
            processed,
            total,
            phase: phase.to_string(),
        },
    );
}

#[tauri::command]
pub async fn validate_export_path(path: String) -> Result<bool> {
    let path = Path::new(&path);

    // Check if parent directory exists and is writable
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Ok(false);
        }
        // Try to create a test file to check writability
        let test_file = parent.join(".nota_write_test");
        match fs::write(&test_file, b"").await {
            Ok(_) => {
                let _ = fs::remove_file(&test_file).await;
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn get_export_stats(app: AppHandle) -> Result<ExportStats> {
    let pool = db::get_db_pool(&app)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    // Get session count
    let session_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
        .fetch_one(&pool)
        .await?;

    // Count note files
    let notes_dir = app_data_dir.join("sessions");
    let note_file_count = if notes_dir.exists() {
        WalkDir::new(&notes_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .count() as u64
    } else {
        0
    };

    // Count attachments
    let attachments_dir = app_data_dir.join("attachments");
    let attachment_count = if attachments_dir.exists() {
        WalkDir::new(&attachments_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .count() as u64
    } else {
        0
    };

    // Calculate total size (approximate)
    let mut total_size_bytes = 0u64;

    for dir in [&notes_dir, &attachments_dir] {
        if dir.exists() {
            for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
                if let Ok(metadata) = entry.metadata() {
                    total_size_bytes += metadata.len();
                }
            }
        }
    }

    // Add approximate database size
    let db_path = app_data_dir.join("app.db");
    if let Ok(metadata) = std::fs::metadata(&db_path) {
        total_size_bytes += metadata.len();
    }

    Ok(ExportStats {
        session_count: session_count as u64,
        note_file_count,
        attachment_count,
        total_size_bytes,
    })
}
