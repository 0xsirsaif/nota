use tauri::{AppHandle, Manager};
use sqlx::{migrate::MigrateDatabase, Sqlite, SqlitePool};

pub async fn init(app: &AppHandle) -> crate::error::Result<()> {
    let db_path = get_db_path(app)?;

    // Create database if it doesn't exist
    if !Sqlite::database_exists(&db_path).await.unwrap_or(false) {
        Sqlite::create_database(&db_path).await?;
    }

    // Connect to database
    let pool = SqlitePool::connect(&db_path).await?;

    // Run migrations
    sqlx::query(include_str!("./migrations/001_initial.sql"))
        .execute(&pool)
        .await?;

    // Store pool in app state
    app.manage(pool);

    Ok(())
}

fn get_db_path(app: &AppHandle) -> crate::error::Result<String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::NotaError::FileSystem(e.to_string()))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| crate::error::NotaError::FileSystem(e.to_string()))?;

    let db_path = app_data_dir.join("app.db");
    Ok(db_path.to_string_lossy().to_string())
}

// Helper to get database pool from app state
pub fn get_db_pool(app: &AppHandle) -> crate::error::Result<SqlitePool> {
    Ok(app.state::<SqlitePool>().inner().clone())
}
