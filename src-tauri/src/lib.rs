mod commands;
mod db;
mod sidecar;

use commands::{scan, photos, analysis, trash};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            db::init_database(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Scan commands
            scan::scan_folder,
            scan::list_subfolders,
            scan::select_folder,
            scan::list_drives,
            scan::browse_directory,
            // Photo commands
            photos::get_photo_thumbnail,
            photos::get_photo_metadata,
            // Analysis commands
            analysis::start_analysis,
            analysis::cancel_analysis,
            analysis::set_similarity_threshold,
            // Trash commands
            trash::move_to_trash,
            trash::restore_from_trash,
            trash::empty_trash,
            trash::get_trash_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
