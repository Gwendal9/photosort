use super::AppError;
use std::fs;

use tauri::Manager;

#[tauri::command]
pub async fn move_to_trash(
    photo_ids: Vec<String>,
    _app: tauri::AppHandle,
) -> Result<(), AppError> {
    log::info!("Moving {} photos to trash", photo_ids.len());
    Ok(())
}

#[tauri::command]
pub async fn restore_from_trash(
    photo_ids: Vec<String>,
    _app: tauri::AppHandle,
) -> Result<(), AppError> {
    log::info!("Restoring {} photos from trash", photo_ids.len());
    Ok(())
}

/// Supprime définitivement les fichiers du disque
#[tauri::command]
pub async fn delete_files(file_paths: Vec<String>) -> Result<DeleteResult, AppError> {
    let mut deleted_count: u32 = 0;
    let mut freed_bytes: u64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for path_str in file_paths {
        let path = std::path::Path::new(&path_str);

        if path.exists() {
            // Get file size before deleting
            if let Ok(metadata) = fs::metadata(path) {
                freed_bytes += metadata.len();
            }

            // Delete the file
            match fs::remove_file(path) {
                Ok(_) => {
                    deleted_count += 1;
                    log::info!("Deleted: {}", path_str);
                }
                Err(e) => {
                    let error_msg = format!("{}: {}", path_str, e);
                    log::error!("Failed to delete: {}", error_msg);
                    errors.push(error_msg);
                }
            }
        } else {
            log::warn!("File not found: {}", path_str);
        }
    }

    Ok(DeleteResult {
        deleted_count,
        freed_bytes,
        errors,
    })
}

#[tauri::command]
pub async fn empty_trash(_app: tauri::AppHandle) -> Result<TrashStats, AppError> {
    // Cette fonction est maintenant gérée côté frontend avec delete_files
    Ok(TrashStats { freed_bytes: 0, count: 0 })
}

#[tauri::command]
pub async fn get_trash_size(_app: tauri::AppHandle) -> Result<TrashStats, AppError> {
    Ok(TrashStats { freed_bytes: 0, count: 0 })
}

#[derive(serde::Serialize)]
pub struct TrashStats {
    pub freed_bytes: u64,
    pub count: u32,
}

#[derive(serde::Serialize)]
pub struct DeleteResult {
    pub deleted_count: u32,
    pub freed_bytes: u64,
    pub errors: Vec<String>,
}
