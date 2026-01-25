pub mod scan;
pub mod photos;
pub mod analysis;
pub mod trash;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Photo {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub width: u32,
    pub height: u32,
    pub created_at: String,
    pub modified_at: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub path: String,
    pub name: String,
    pub photo_count: Option<u32>,
    pub is_excluded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityGroup {
    pub id: String,
    pub photos: Vec<Photo>,
    pub similarity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    pub id: String,
    pub photo: Photo,
    pub deleted_at: String,
    pub original_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisProgress {
    pub current: u32,
    pub total: u32,
    pub status: String,
    pub estimated_time_remaining: Option<u32>,
}

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Fichier introuvable: {0}")]
    FileNotFound(String),
    #[error("Permission refusée: {0}")]
    PermissionDenied(String),
    #[error("Échec de l'analyse: {0}")]
    AnalysisFailed(String),
    #[error("Erreur de base de données: {0}")]
    DatabaseError(String),
    #[error("Erreur du sidecar: {0}")]
    SidecarError(String),
    #[error("Erreur interne: {0}")]
    InternalError(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::FileNotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied(err.to_string()),
            _ => AppError::InternalError(err.to_string()),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}
