use super::{AppError, Photo};
use image::imageops::FilterType;
use image::GenericImageView;
use std::fs;
use std::path::Path;

const THUMBNAIL_SIZE: u32 = 300;

#[tauri::command]
pub async fn get_photo_thumbnail(
    photo_id: String,
    app: tauri::AppHandle,
) -> Result<String, AppError> {
    // In a real implementation, we would:
    // 1. Look up the photo path from the database using photo_id
    // 2. Generate or retrieve cached thumbnail
    // 3. Return the thumbnail path as an asset URL

    // For now, return a placeholder
    Err(AppError::FileNotFound(format!(
        "Photo {} not found in database",
        photo_id
    )))
}

#[tauri::command]
pub async fn get_photo_metadata(photo_id: String) -> Result<Photo, AppError> {
    // In a real implementation, we would look up the photo in the database
    Err(AppError::FileNotFound(format!(
        "Photo {} not found in database",
        photo_id
    )))
}

/// Generate a thumbnail for a photo and save it to the cache directory
pub fn generate_thumbnail(photo_path: &Path, cache_dir: &Path) -> Result<String, AppError> {
    let img = image::open(photo_path).map_err(|e| AppError::InternalError(e.to_string()))?;

    let (width, height) = img.dimensions();
    let ratio = width as f32 / height as f32;

    let (new_width, new_height) = if ratio > 1.0 {
        (THUMBNAIL_SIZE, (THUMBNAIL_SIZE as f32 / ratio) as u32)
    } else {
        ((THUMBNAIL_SIZE as f32 * ratio) as u32, THUMBNAIL_SIZE)
    };

    let thumbnail = img.resize(new_width, new_height, FilterType::Lanczos3);

    // Create thumbnail filename based on original path hash
    let path_hash = format!("{:x}", md5_hash(photo_path.to_string_lossy().as_bytes()));
    let thumbnail_path = cache_dir.join(format!("{}.jpg", path_hash));

    // Ensure cache directory exists
    fs::create_dir_all(cache_dir)?;

    // Save thumbnail
    thumbnail
        .save(&thumbnail_path)
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(thumbnail_path.to_string_lossy().to_string())
}

/// Simple hash function for generating unique thumbnail names
fn md5_hash(data: &[u8]) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    hasher.finish()
}
