use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::Manager;

const SCHEMA: &str = r#"
-- Photos table
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    thumbnail_path TEXT,
    embedding BLOB
);

-- Indexes for photos
CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);

-- Trash table
CREATE TABLE IF NOT EXISTS trash (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    original_path TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    FOREIGN KEY (photo_id) REFERENCES photos(id)
);

-- Similarity groups table
CREATE TABLE IF NOT EXISTS similarity_groups (
    id TEXT PRIMARY KEY,
    similarity REAL NOT NULL,
    created_at TEXT NOT NULL
);

-- Group members junction table
CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    PRIMARY KEY (group_id, photo_id),
    FOREIGN KEY (group_id) REFERENCES similarity_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('similarity_threshold', '0.85');
"#;

pub fn init_database(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("photosort.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent access
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Create schema
    conn.execute_batch(SCHEMA)?;

    log::info!("Database initialized at {:?}", db_path);

    Ok(())
}

pub fn get_connection(app: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    let db_path = app_data_dir.join("photosort.db");
    let conn = Connection::open(&db_path)?;
    Ok(conn)
}
