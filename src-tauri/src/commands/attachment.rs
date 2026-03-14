use chrono::Utc;
use tauri::{AppHandle, Manager};

use crate::db;
use crate::error::{NotaError, Result};
use crate::models::attachment::{Attachment, AttachmentType, CreateAttachmentInput};

#[tauri::command]
pub async fn add_attachment(app: AppHandle, input: CreateAttachmentInput) -> Result<Attachment> {
    let pool = db::get_db_pool(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // For file attachments, copy file to app data dir
    let final_path = if input.type_ == AttachmentType::File {
        if let Some(source_path) = &input.file_path {
            let file_name = std::path::Path::new(source_path)
                .file_name()
                .ok_or_else(|| NotaError::Validation("Invalid file path".to_string()))?
                .to_string_lossy()
                .to_string();

            // Create attachments dir: app_data/attachments/<session_id>/<uuid>_<filename>
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| NotaError::FileSystem(e.to_string()))?;
            let attachments_dir = app_data_dir
                .join("attachments")
                .join(&input.session_id);

            std::fs::create_dir_all(&attachments_dir)
                .map_err(|e| NotaError::FileSystem(e.to_string()))?;

            let dest_path = attachments_dir.join(format!("{}_{}", id, file_name));

            // Copy the file
            std::fs::copy(source_path, &dest_path)
                .map_err(|e| NotaError::FileSystem(format!("Failed to copy file: {}", e)))?;

            Some(dest_path.to_string_lossy().to_string())
        } else {
            return Err(NotaError::Validation("File path required for file attachments".to_string()));
        }
    } else {
        None
    };

    // For link attachments, validate URL
    let final_url = if input.type_ == AttachmentType::Link {
        if input.url.is_none() {
            return Err(NotaError::Validation("URL required for link attachments".to_string()));
        }
        input.url.clone()
    } else {
        None
    };

    let attachment = Attachment {
        id: id.clone(),
        session_id: input.session_id.clone(),
        type_: input.type_,
        label: input.label,
        file_path: final_path,
        url: final_url,
        created_at: now.clone(),
    };

    sqlx::query(
        "INSERT INTO attachments (id, session_id, type, label, file_path, url, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(&attachment.id)
    .bind(&attachment.session_id)
    .bind(match attachment.type_ {
        AttachmentType::File => "file",
        AttachmentType::Link => "link",
    })
    .bind(&attachment.label)
    .bind(&attachment.file_path)
    .bind(&attachment.url)
    .bind(&attachment.created_at)
    .execute(&pool)
    .await?;

    Ok(attachment)
}

#[tauri::command]
pub async fn get_attachments(app: AppHandle, session_id: String) -> Result<Vec<Attachment>> {
    let pool = db::get_db_pool(&app)?;

    let rows = sqlx::query_as::<_, AttachmentRow>(
        "SELECT id, session_id, type, label, file_path, url, created_at
         FROM attachments
         WHERE session_id = ?1
         ORDER BY created_at DESC"
    )
    .bind(&session_id)
    .fetch_all(&pool)
    .await?;

    let attachments = rows.into_iter().map(|row| Attachment {
        id: row.id,
        session_id: row.session_id,
        type_: match row.type_.as_str() {
            "link" => AttachmentType::Link,
            _ => AttachmentType::File,
        },
        label: row.label,
        file_path: row.file_path,
        url: row.url,
        created_at: row.created_at,
    }).collect();

    Ok(attachments)
}

#[tauri::command]
pub async fn delete_attachment(app: AppHandle, id: String) -> Result<()> {
    let pool = db::get_db_pool(&app)?;

    // Get attachment info first to delete the file if it's a file attachment
    let row: Option<AttachmentRow> = sqlx::query_as(
        "SELECT id, session_id, type, label, file_path, url, created_at
         FROM attachments
         WHERE id = ?1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?;

    if let Some(attachment) = row {
        // Delete the physical file if it exists
        if attachment.type_ == "file" {
            if let Some(file_path) = attachment.file_path {
                let _ = std::fs::remove_file(&file_path);
            }
        }

        // Delete from database
        sqlx::query("DELETE FROM attachments WHERE id = ?1")
            .bind(&id)
            .execute(&pool)
            .await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_attachment(app: AppHandle, id: String) -> Result<()> {
    let pool = db::get_db_pool(&app)?;

    let row: Option<AttachmentRow> = sqlx::query_as(
        "SELECT id, session_id, type, label, file_path, url, created_at
         FROM attachments
         WHERE id = ?1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await?;

    if let Some(attachment) = row {
        match attachment.type_.as_str() {
            "file" => {
                if let Some(file_path) = attachment.file_path {
                    // Check if file exists
                    if !std::path::Path::new(&file_path).exists() {
                        return Err(NotaError::NotFound(format!("File not found: {}", file_path)));
                    }
                    open::that(&file_path)
                        .map_err(|e| NotaError::FileSystem(format!("Failed to open file '{}': {}", file_path, e)))?;
                } else {
                    return Err(NotaError::NotFound("File path not found".to_string()));
                }
            }
            "link" => {
                if let Some(url) = attachment.url {
                    open::that(&url)
                        .map_err(|e| NotaError::FileSystem(format!("Failed to open link '{}': {}", url, e)))?;
                } else {
                    return Err(NotaError::NotFound("URL not found".to_string()));
                }
            }
            _ => return Err(NotaError::Validation("Invalid attachment type".to_string())),
        }
    } else {
        return Err(NotaError::NotFound("Attachment not found".to_string()));
    }

    Ok(())
}

#[derive(sqlx::FromRow)]
struct AttachmentRow {
    id: String,
    session_id: String,
    #[sqlx(rename = "type")]
    type_: String,
    label: Option<String>,
    file_path: Option<String>,
    url: Option<String>,
    created_at: String,
}
