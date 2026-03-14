use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use walkdir::WalkDir;

use crate::db;
use crate::error::{NotaError, Result};
use crate::commands::export::{ExportManifest, ExportStats};

const MANIFEST_FILENAME: &str = "manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportValidation {
    pub valid: bool,
    pub manifest: Option<ExportManifest>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConflict {
    pub session_id: String,
    pub title: String,
    pub local_modified: DateTime<Utc>,
    pub backup_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub manifest: ExportManifest,
    pub backup_stats: ExportStats,
    pub conflicts: Vec<SessionConflict>,
    pub new_sessions: Vec<BackupSessionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSessionSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictStrategy {
    SkipExisting,
    Replace,
    KeepBoth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: u64,
    pub skipped_count: u64,
    pub replaced_count: u64,
    pub renamed_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportProgress {
    pub operation_id: String,
    pub percent: u8,
    pub current_file: String,
    pub processed: u64,
    pub total: u64,
    pub phase: String,
}

#[tauri::command]
pub async fn validate_import_file(path: String) -> Result<ImportValidation> {
    let path = Path::new(&path);

    // Check file exists
    if !path.exists() {
        return Ok(ImportValidation {
            valid: false,
            manifest: None,
            errors: vec!["File not found".to_string()],
            warnings: vec![],
        });
    }

    // Check file extension
    if let Some(ext) = path.extension() {
        if ext != "nota" && ext != "zip" {
            return Ok(ImportValidation {
                valid: false,
                manifest: None,
                errors: vec!["File must be a .nota or .zip file".to_string()],
                warnings: vec![],
            });
        }
    }

    // Try to open as ZIP and read manifest
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(e) => {
            return Ok(ImportValidation {
                valid: false,
                manifest: None,
                errors: vec![format!("Cannot open file: {}", e)],
                warnings: vec![],
            });
        }
    };

    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(e) => {
            return Ok(ImportValidation {
                valid: false,
                manifest: None,
                errors: vec![format!("Invalid archive: {}", e)],
                warnings: vec![],
            });
        }
    };

    // Find and read manifest
    let manifest: ExportManifest = match archive.by_name(MANIFEST_FILENAME) {
        Ok(mut file) => {
            let mut contents = String::new();
            if let Err(e) = std::io::Read::read_to_string(&mut file, &mut contents) {
                return Ok(ImportValidation {
                    valid: false,
                    manifest: None,
                    errors: vec![format!("Failed to read manifest: {}", e)],
                    warnings: vec![],
                });
            }
            match serde_json::from_str(&contents) {
                Ok(m) => m,
                Err(e) => {
                    return Ok(ImportValidation {
                        valid: false,
                        manifest: None,
                        errors: vec![format!("Invalid manifest JSON: {}", e)],
                        warnings: vec![],
                    });
                }
            }
        }
        Err(_) => {
            return Ok(ImportValidation {
                valid: false,
                manifest: None,
                errors: vec!["Manifest not found in archive".to_string()],
                warnings: vec![],
            });
        }
    };

    // Validate version compatibility
    let version = manifest.version.clone();
    let mut warnings = vec![];

    if !version.starts_with("1.") {
        return Ok(ImportValidation {
            valid: false,
            manifest: Some(manifest),
            errors: vec![format!("Unsupported backup version: {}. Only version 1.x is supported.", version)],
            warnings: vec![],
        });
    }

    // Warn if backup is from newer app version
    let app_version = env!("CARGO_PKG_VERSION");
    if manifest.nota_version != app_version {
        warnings.push(format!(
            "Backup was created with Nota v{}, current version is v{}. Some features may not be compatible.",
            manifest.nota_version, app_version
        ));
    }

    Ok(ImportValidation {
        valid: true,
        manifest: Some(manifest),
        errors: vec![],
        warnings,
    })
}

#[tauri::command]
pub async fn get_import_preview(app: AppHandle, path: String) -> Result<ImportPreview> {
    let path = Path::new(&path);
    let pool = db::get_db_pool(&app)?;

    // Open archive
    let file = std::fs::File::open(path).map_err(|e| {
        NotaError::FileSystem(format!("Cannot open file: {}", e))
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        NotaError::FileSystem(format!("Invalid archive: {}", e))
    })?;

    // Read manifest
    let manifest: ExportManifest = {
        let mut file = archive.by_name(MANIFEST_FILENAME).map_err(|e| {
            NotaError::FileSystem(format!("Manifest not found: {}", e))
        })?;
        let mut contents = String::new();
        std::io::Read::read_to_string(&mut file, &mut contents).map_err(|e| {
            NotaError::FileSystem(format!("Failed to read manifest: {}", e))
        })?;
        serde_json::from_str(&contents).map_err(|e| {
            NotaError::Internal(format!("Invalid manifest: {}", e))
        })?
    };

    // Read sessions from backup
    let backup_sessions: Vec<serde_json::Value> = {
        let mut file = archive.by_name("database/sessions.json").map_err(|e| {
            NotaError::FileSystem(format!("Sessions file not found: {}", e))
        })?;
        let mut contents = String::new();
        std::io::Read::read_to_string(&mut file, &mut contents).map_err(|e| {
            NotaError::FileSystem(format!("Failed to read sessions: {}", e))
        })?;
        serde_json::from_str(&contents).map_err(|e| {
            NotaError::Internal(format!("Invalid sessions JSON: {}", e))
        })?
    };

    // Get existing session IDs from database
    let existing_ids: HashSet<String> = sqlx::query_scalar::<_, String>("SELECT id FROM sessions")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .collect();

    // Store count before consuming the vector
    let session_count = backup_sessions.len() as u64;

    // Find conflicts and new sessions
    let mut conflicts = vec![];
    let mut new_sessions = vec![];

    for session in backup_sessions {
        let id = session.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let title = session.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
        let status = session.get("status").and_then(|v| v.as_str()).unwrap_or("planned").to_string();

        let created_at_str = session.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        let created_at = parse_datetime(created_at_str).unwrap_or_else(|_| Utc::now());

        if existing_ids.contains(&id) {
            // This is a conflict - get local modified time
            let local_modified: String = sqlx::query_scalar("SELECT updated_at FROM sessions WHERE id = ?1")
                .bind(&id)
                .fetch_one(&pool)
                .await?;

            let backup_modified_str = session.get("updated_at").and_then(|v| v.as_str()).unwrap_or(created_at_str);
            let local_modified_dt = parse_datetime(&local_modified)?;
            let backup_modified_dt = parse_datetime(backup_modified_str)?;

            conflicts.push(SessionConflict {
                session_id: id,
                title,
                local_modified: local_modified_dt,
                backup_modified: backup_modified_dt,
            });
        } else {
            new_sessions.push(BackupSessionSummary {
                id,
                title,
                status,
                created_at,
            });
        }
    }

    Ok(ImportPreview {
        manifest,
        backup_stats: ExportStats {
            session_count,
            note_file_count: 0, // Will be calculated from files
            attachment_count: 0,
            total_size_bytes: 0,
        },
        conflicts,
        new_sessions,
    })
}

#[tauri::command]
pub async fn import_backup(
    app: AppHandle,
    path: String,
    conflict_strategy: ConflictStrategy,
) -> Result<ImportResult> {
    let operation_id = format!("import_{}", uuid::Uuid::new_v4().simple());
    let source_path = Path::new(&path);
    let pool = db::get_db_pool(&app)?;

    emit_import_progress(&app, &operation_id, 0, "", 0, 0, "Starting import...");

    // Get app data directory for extracting files
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| NotaError::FileSystem(e.to_string()))?;

    // Create temp directory for extraction
    let temp_dir = tempfile::tempdir().map_err(|e| {
        NotaError::Internal(format!("Failed to create temp directory: {}", e))
    })?;
    let temp_path = temp_dir.path();

    emit_import_progress(&app, &operation_id, 5, "", 0, 0, "Extracting archive...");

    // Extract ZIP
    extract_zip(source_path, temp_path, &app, &operation_id).await?;

    emit_import_progress(&app, &operation_id, 30, "", 0, 0, "Reading backup data...");

    // Read sessions from backup
    let sessions_json = fs::read_to_string(temp_path.join("database/sessions.json")).await
        .map_err(|e| NotaError::FileSystem(format!("Failed to read sessions: {}", e)))?;
    let backup_sessions: Vec<serde_json::Value> = serde_json::from_str(&sessions_json)
        .map_err(|e| NotaError::Internal(format!("Invalid sessions JSON: {}", e)))?;

    // Get existing session IDs
    let existing_ids: HashSet<String> = sqlx::query_scalar::<_, String>("SELECT id FROM sessions")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .collect();

    emit_import_progress(&app, &operation_id, 40, "", 0, 0, "Importing sessions...");

    // Import sessions
    let mut imported_count = 0u64;
    let mut skipped_count = 0u64;
    let mut replaced_count = 0u64;
    let mut renamed_count = 0u64;

    let total = backup_sessions.len() as u64;

    for (idx, session) in backup_sessions.iter().enumerate() {
        let id = session.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();

        emit_import_progress(
            &app,
            &operation_id,
            40 + (40 * idx as u64 / total.max(1)) as u8,
            &id,
            idx as u64,
            total,
            "Importing sessions...",
        );

        if existing_ids.contains(&id) {
            match conflict_strategy {
                ConflictStrategy::SkipExisting => {
                    skipped_count += 1;
                    continue;
                }
                ConflictStrategy::Replace => {
                    // Delete existing session
                    sqlx::query("DELETE FROM sessions WHERE id = ?1")
                        .bind(&id)
                        .execute(&pool)
                        .await?;
                    replaced_count += 1;
                }
                ConflictStrategy::KeepBoth => {
                    // Generate new ID and update paths
                    let new_id = format!("sess_{}", uuid::Uuid::new_v4().simple());
                    renamed_count += 1;
                    insert_session_with_id(&pool, session, &new_id).await?;
                    continue;
                }
            }
        } else {
            imported_count += 1;
        }

        insert_session(&pool, session).await?;
    }

    emit_import_progress(&app, &operation_id, 85, "", 0, 0, "Importing notes...");

    // Copy notes
    let notes_src = temp_path.join("notes");
    let notes_dst = app_data_dir.join("sessions");
    if notes_src.exists() {
        copy_directory_contents(&notes_src, &notes_dst).await?;
    }

    emit_import_progress(&app, &operation_id, 95, "", 0, 0, "Importing attachments...");

    // Copy attachments
    let attachments_src = temp_path.join("attachments");
    let attachments_dst = app_data_dir.join("attachments");
    if attachments_src.exists() {
        copy_directory_contents(&attachments_src, &attachments_dst).await?;
    }

    emit_import_progress(&app, &operation_id, 100, "", 0, 0, "Import complete!");

    Ok(ImportResult {
        imported_count,
        skipped_count,
        replaced_count,
        renamed_count,
    })
}

async fn insert_session(pool: &sqlx::SqlitePool, session: &serde_json::Value) -> Result<()> {
    insert_session_with_id(pool, session,
        session.get("id").and_then(|v| v.as_str()).unwrap_or("")
    ).await
}

async fn insert_session_with_id(pool: &sqlx::SqlitePool, session: &serde_json::Value, id: &str) -> Result<()> {
    let get_str = |key: &str| -> Option<String> {
        session.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
    };
    let get_i64 = |key: &str| -> i64 {
        session.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
    };

    sqlx::query(
        r#"
        INSERT INTO sessions (
            id, title, slug, status, created_at, updated_at, scheduled_for,
            started_at, paused_at, ended_at, total_elapsed_seconds, active_elapsed_seconds,
            break_elapsed_seconds, goal_summary, goal_specific, goal_measurable,
            goal_achievable, goal_relevant, goal_time_bound, expected_output,
            outcome_summary, reflection_summary, success_criteria_met,
            notes_markdown_path, reflection_markdown_path, toggl_workspace_id,
            toggl_project_id, toggl_time_entry_id, last_toggl_sync_at,
            toggl_sync_status, tags
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31)
        "#
    )
    .bind(id)
    .bind(get_str("title").unwrap_or_default())
    .bind(get_str("slug").unwrap_or_default())
    .bind(get_str("status").unwrap_or_else(|| "planned".to_string()))
    .bind(get_str("created_at").unwrap_or_default())
    .bind(get_str("updated_at").unwrap_or_default())
    .bind(get_str("scheduled_for"))
    .bind(get_str("started_at"))
    .bind(get_str("paused_at"))
    .bind(get_str("ended_at"))
    .bind(get_i64("total_elapsed_seconds"))
    .bind(get_i64("active_elapsed_seconds"))
    .bind(get_i64("break_elapsed_seconds"))
    .bind(get_str("goal_summary"))
    .bind(get_str("goal_specific"))
    .bind(get_str("goal_measurable"))
    .bind(get_str("goal_achievable"))
    .bind(get_str("goal_relevant"))
    .bind(get_str("goal_time_bound"))
    .bind(get_str("expected_output"))
    .bind(get_str("outcome_summary"))
    .bind(get_str("reflection_summary"))
    .bind(session.get("success_criteria_met").and_then(|v| v.as_i64()))
    .bind(get_str("notes_markdown_path").unwrap_or_default())
    .bind(get_str("reflection_markdown_path"))
    .bind(get_str("toggl_workspace_id"))
    .bind(get_str("toggl_project_id"))
    .bind(get_str("toggl_time_entry_id"))
    .bind(get_str("last_toggl_sync_at"))
    .bind(get_str("toggl_sync_status"))
    .bind(get_str("tags"))
    .execute(pool)
    .await?;

    Ok(())
}

async fn extract_zip(
    source: &Path,
    dest: &Path,
    app: &AppHandle,
    operation_id: &str,
) -> Result<()> {
    let source = source.to_path_buf();
    let dest = dest.to_path_buf();
    let app = app.clone();
    let operation_id = operation_id.to_string();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&source).map_err(|e| {
            NotaError::FileSystem(format!("Failed to open ZIP: {}", e))
        })?;

        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            NotaError::FileSystem(format!("Invalid ZIP archive: {}", e))
        })?;

        let total = archive.len() as u64;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                NotaError::FileSystem(format!("Failed to read ZIP entry: {}", e))
            })?;

            let outpath = dest.join(file.name());

            let _ = app.emit(
                "import-progress",
                ImportProgress {
                    operation_id: operation_id.clone(),
                    percent: 5 + (25 * i as u64 / total.max(1)) as u8,
                    current_file: file.name().to_string(),
                    processed: i as u64,
                    total,
                    phase: "Extracting files...".to_string(),
                },
            );

            if file.is_dir() {
                std::fs::create_dir_all(&outpath).map_err(|e| {
                    NotaError::FileSystem(format!("Failed to create directory: {}", e))
                })?;
            } else {
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| {
                        NotaError::FileSystem(format!("Failed to create parent directory: {}", e))
                    })?;
                }
                let mut outfile = std::fs::File::create(&outpath).map_err(|e| {
                    NotaError::FileSystem(format!("Failed to create file: {}", e))
                })?;
                let mut buffer = Vec::new();
                std::io::Read::read_to_end(&mut file, &mut buffer).map_err(|e| {
                    NotaError::FileSystem(format!("Failed to read ZIP entry: {}", e))
                })?;
                std::io::Write::write_all(&mut outfile, &buffer).map_err(|e| {
                    NotaError::FileSystem(format!("Failed to write file: {}", e))
                })?;
            }
        }

        Ok::<(), NotaError>(())
    })
    .await
    .map_err(|e| NotaError::Internal(format!("Extraction task failed: {}", e)))?
}

async fn copy_directory_contents(source: &Path, dest: &Path) -> Result<()> {
    if !source.exists() {
        return Ok(());
    }

    fs::create_dir_all(dest).await.map_err(|e| {
        NotaError::FileSystem(format!("Failed to create directory: {}", e))
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
        }
    }

    Ok(())
}

fn parse_datetime(s: &str) -> Result<DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| NotaError::Validation(format!("Invalid date: {}", e)))
}

fn emit_import_progress(
    app: &AppHandle,
    operation_id: &str,
    percent: u8,
    current_file: &str,
    processed: u64,
    total: u64,
    phase: &str,
) {
    let _ = app.emit(
        "import-progress",
        ImportProgress {
            operation_id: operation_id.to_string(),
            percent,
            current_file: current_file.to_string(),
            processed,
            total,
            phase: phase.to_string(),
        },
    );
}
