use super::{AnalysisProgress, AppError, Photo, SimilarityGroup};
use chrono::{DateTime, Utc};
use image_hasher::{HasherConfig, HashAlg};
use rayon::prelude::*;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use uuid::Uuid;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "gif"];
static ANALYSIS_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Clone)]
struct PhotoWithHash {
    photo: Photo,
    hash: Option<Vec<u8>>,
}

#[tauri::command]
pub async fn start_analysis(
    folder_paths: Vec<String>,
    app: tauri::AppHandle,
) -> Result<Vec<SimilarityGroup>, AppError> {
    ANALYSIS_CANCELLED.store(false, Ordering::SeqCst);

    // Step 1: Collect all photo paths
    let mut photo_paths: Vec<String> = Vec::new();
    for folder in &folder_paths {
        for entry in WalkDir::new(folder)
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
                    photo_paths.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    let total = photo_paths.len() as u32;
    if total == 0 {
        return Ok(Vec::new());
    }

    // Emit initial progress
    let _ = app.emit("analysis-progress", AnalysisProgress {
        current: 0,
        total,
        status: "Analyse des photos...".to_string(),
        estimated_time_remaining: None,
    });

    // Step 2: Generate hashes for all photos in parallel
    // Use smaller hash size (8x8) for faster processing
    let hasher = HasherConfig::new()
        .hash_alg(HashAlg::Gradient) // Faster algorithm
        .hash_size(8, 8) // Smaller hash = faster comparison
        .to_hasher();

    let processed = AtomicU32::new(0);
    let app_clone = app.clone();

    let photos_with_hashes: Vec<PhotoWithHash> = photo_paths
        .par_iter()
        .filter_map(|path_str| {
            if ANALYSIS_CANCELLED.load(Ordering::SeqCst) {
                return None;
            }

            let path = Path::new(path_str);
            let photo = create_photo_from_path(path).ok()?;

            // Try to generate hash - resize image first for speed
            let hash = image::open(path)
                .ok()
                .map(|img| {
                    // Resize to small size before hashing for speed
                    let small = img.thumbnail(200, 200);
                    hasher.hash_image(&small).as_bytes().to_vec()
                });

            // Update progress every 5 photos or at the end
            let current = processed.fetch_add(1, Ordering::SeqCst) + 1;
            if current % 5 == 0 || current == total {
                let _ = app_clone.emit("analysis-progress", AnalysisProgress {
                    current,
                    total,
                    status: format!("Analyse: {}/{} photos", current, total),
                    estimated_time_remaining: None,
                });
            }

            Some(PhotoWithHash { photo, hash })
        })
        .collect();

    if ANALYSIS_CANCELLED.load(Ordering::SeqCst) {
        return Ok(Vec::new());
    }

    // Step 3: Group similar photos by hash similarity
    let _ = app.emit("analysis-progress", AnalysisProgress {
        current: total,
        total,
        status: "Recherche de photos similaires...".to_string(),
        estimated_time_remaining: None,
    });

    let mut groups: Vec<SimilarityGroup> = Vec::new();
    let mut used_indices: Vec<bool> = vec![false; photos_with_hashes.len()];

    // Compare photos and group similar ones
    for i in 0..photos_with_hashes.len() {
        if used_indices[i] {
            continue;
        }

        let photo_i = &photos_with_hashes[i];
        if photo_i.hash.is_none() {
            continue;
        }

        let hash_i = photo_i.hash.as_ref().unwrap();
        let mut similar_photos: Vec<Photo> = vec![photo_i.photo.clone()];
        used_indices[i] = true;

        for j in (i + 1)..photos_with_hashes.len() {
            if used_indices[j] {
                continue;
            }

            let photo_j = &photos_with_hashes[j];
            if photo_j.hash.is_none() {
                continue;
            }

            let hash_j = photo_j.hash.as_ref().unwrap();

            // Calculate hamming distance
            let distance = hamming_distance(hash_i, hash_j);
            let similarity = 1.0 - (distance as f32 / (hash_i.len() * 8) as f32);

            // If similarity > 85%, consider them similar
            if similarity > 0.85 {
                similar_photos.push(photo_j.photo.clone());
                used_indices[j] = true;
            }
        }

        // Only create a group if there are 2+ similar photos
        if similar_photos.len() >= 2 {
            groups.push(SimilarityGroup {
                id: Uuid::new_v4().to_string(),
                photos: similar_photos,
                similarity: 0.9, // Average similarity for the group
            });
        }
    }

    // Final progress update
    let _ = app.emit("analysis-progress", AnalysisProgress {
        current: total,
        total,
        status: format!("Terminé: {} groupes trouvés", groups.len()),
        estimated_time_remaining: None,
    });

    Ok(groups)
}

fn hamming_distance(a: &[u8], b: &[u8]) -> u32 {
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x ^ y).count_ones())
        .sum()
}

fn create_photo_from_path(path: &Path) -> Result<Photo, AppError> {
    let metadata = fs::metadata(path)?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Inconnu")
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
    let (width, height) = image::image_dimensions(path).unwrap_or((0, 0));

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

#[tauri::command]
pub async fn cancel_analysis() -> Result<(), AppError> {
    ANALYSIS_CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn set_similarity_threshold(threshold: f32) -> Result<(), AppError> {
    // In a real implementation, we would store this in the database or app state
    // For now, just validate the threshold
    if threshold < 0.0 || threshold > 1.0 {
        return Err(AppError::InternalError(
            "Le seuil de similarité doit être entre 0 et 1".to_string(),
        ));
    }

    Ok(())
}

/// Check if analysis has been cancelled
pub fn is_cancelled() -> bool {
    ANALYSIS_CANCELLED.load(Ordering::SeqCst)
}

/// Emit analysis progress to the frontend
pub fn emit_progress(app: &tauri::AppHandle, progress: &AnalysisProgress) {
    use tauri::Emitter;
    let _ = app.emit("analysis-progress", progress);
}
