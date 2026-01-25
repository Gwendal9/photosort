use super::{AppError, Folder, Photo};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "heic", "heif", "webp", "cr2", "nef", "arw", "dng"];

#[tauri::command]
pub async fn scan_folder(path: String) -> Result<Vec<Photo>, AppError> {
    let mut photos = Vec::new();

    for entry in WalkDir::new(&path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if let Some(ext) = extension {
            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                if let Ok(photo) = create_photo_from_path(path) {
                    photos.push(photo);
                }
            }
        }
    }

    Ok(photos)
}

#[tauri::command]
pub async fn list_subfolders(path: String) -> Result<Vec<Folder>, AppError> {
    let mut folders = Vec::new();

    let entries = fs::read_dir(&path)?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();

            // Count photos in this folder
            let photo_count = count_photos_in_folder(&path);

            folders.push(Folder {
                path: path.to_string_lossy().to_string(),
                name,
                photo_count: Some(photo_count),
                is_excluded: false,
            });
        }
    }

    Ok(folders)
}

#[tauri::command]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel();

    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });

    // Wait for the dialog result
    match rx.recv() {
        Ok(path) => Ok(path),
        Err(_) => Ok(None),
    }
}

fn create_photo_from_path(path: &Path) -> Result<Photo, AppError> {
    let metadata = fs::metadata(path)?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let size = metadata.len();

    let created_at = metadata
        .created()
        .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
        .unwrap_or_else(|_| Utc::now().to_rfc3339());

    let modified_at = metadata
        .modified()
        .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
        .unwrap_or_else(|_| Utc::now().to_rfc3339());

    // Try to get image dimensions
    let (width, height) = get_image_dimensions(path).unwrap_or((0, 0));

    Ok(Photo {
        id: Uuid::new_v4().to_string(),
        path: path.to_string_lossy().to_string(),
        filename,
        size,
        width,
        height,
        created_at,
        modified_at,
        thumbnail_path: None,
    })
}

fn get_image_dimensions(path: &Path) -> Option<(u32, u32)> {
    image::image_dimensions(path).ok()
}

fn count_photos_in_folder(path: &Path) -> u32 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().is_file()
                && e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                    .unwrap_or(false)
        })
        .count() as u32
}
