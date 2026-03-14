pub mod commands;
pub mod db;
pub mod error;
pub mod models;

use tauri::menu::{Menu, PredefinedMenuItem, Submenu};

#[tauri::command]
async fn greet(name: String) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Create menu with standard edit commands
            let edit_menu = Submenu::with_items(
                app.handle(),
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app.handle(), None::<&str>)?,
                    &PredefinedMenuItem::separator(app.handle())?,
                    &PredefinedMenuItem::cut(app.handle(), None::<&str>)?,
                    &PredefinedMenuItem::copy(app.handle(), None::<&str>)?,
                    &PredefinedMenuItem::paste(app.handle(), None::<&str>)?,
                    &PredefinedMenuItem::select_all(app.handle(), None::<&str>)?,
                ],
            )?;

            let menu = Menu::with_items(app.handle(), &[&edit_menu])?;
            app.set_menu(menu)?;

            // Initialize database
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init(&handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::session::create_session,
            commands::session::get_sessions,
            commands::session::update_session,
            commands::session::delete_session,
            commands::session::prepare_duplicate_session,
            commands::session::create_duplicate_session,
            commands::timer::get_timer_state,
            commands::timer::update_timer_state,
            commands::timer::send_timer_notification,
            commands::fs::read_markdown_file,
            commands::fs::write_markdown_file,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::attachment::add_attachment,
            commands::attachment::get_attachments,
            commands::attachment::delete_attachment,
            commands::attachment::open_attachment,
            commands::toggl::toggl_validate_token,
            commands::toggl::toggl_get_workspaces,
            commands::toggl::toggl_get_projects,
            commands::toggl::toggl_create_time_entry,
            commands::toggl::toggl_disconnect,
            commands::toggl::toggl_get_sync_status,
            commands::export::export_full_backup,
            commands::export::validate_export_path,
            commands::export::get_export_stats,
            commands::import::validate_import_file,
            commands::import::get_import_preview,
            commands::import::import_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
