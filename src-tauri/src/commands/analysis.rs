use super::{AnalysisProgress, AppError, SimilarityGroup};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

static ANALYSIS_CANCELLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn start_analysis(
    folder_paths: Vec<String>,
    app: tauri::AppHandle,
) -> Result<Vec<SimilarityGroup>, AppError> {
    ANALYSIS_CANCELLED.store(false, Ordering::SeqCst);

    // In a real implementation, we would:
    // 1. Scan all photos in the folders
    // 2. Generate embeddings using the Python sidecar
    // 3. Calculate similarity between embeddings
    // 4. Group similar photos together
    // 5. Emit progress events to the frontend

    // For now, return empty results - the actual ML logic will be in the Python sidecar
    Ok(Vec::new())
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
