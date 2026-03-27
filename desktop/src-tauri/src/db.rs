use crate::state::ChangeEvent;
use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::Path;
use tracing::{error, info};

/// Initialize a database connection for a specific repository (project folder).
/// This will create the .backtrack folder and db.sqlite file if they don't exist.
pub fn init_repo_db(project_root: &Path) -> Result<Connection> {
    let backtrack_dir = project_root.join(".backtrack");
    if !backtrack_dir.exists() {
        if let Err(e) = fs::create_dir(&backtrack_dir) {
            error!("Failed to create .backtrack directory: {}", e);
            return Err(rusqlite::Error::InvalidPath(backtrack_dir.into()));
        }
    }

    let db_path = backtrack_dir.join("db.sqlite");
    let conn = Connection::open(db_path)?;

    // Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL;", [])?;
    conn.execute("PRAGMA synchronous=NORMAL;", [])?;

    // Run migrations
    migrate(&conn)?;

    Ok(conn)
}

/// Ensure database schema is up to date
fn migrate(conn: &Connection) -> Result<()> {
    // Basic schema for Phase 1
    // We store the serialized ChangeEvent as JSON for now for flexibility,
    // plus indexed columns for searching.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS file_history (
            id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            summary TEXT,
            change_type TEXT,
            hash TEXT,
            json_data TEXT
        )",
        [],
    )?;

    // Add validation index
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_file_path ON file_history(file_path)",
        [],
    )?;

    Ok(())
}

/// Log a change event to the repository database
pub fn log_change(project_root: &Path, change: &ChangeEvent) -> Result<()> {
    let conn = init_repo_db(project_root)?;

    let json = serde_json::to_string(change).map_err(|e| {
        error!("Serialization error: {}", e);
        rusqlite::Error::ToSqlConversionFailure(Box::new(e))
    })?;

    // Determine change type based on diff summary or stats
    let change_type = if change.diff.is_some() {
        "diff"
    } else {
        "snapshot"
    };

    conn.execute(
        "INSERT INTO file_history (file_path, timestamp, summary, change_type, hash, json_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            change.file_path,
            change.timestamp.to_rfc3339(),
            change.summary,
            change_type,
            change.file_hash,
            json
        ],
    )?;

    info!("Saved change to DB: {}", change.summary);
    Ok(())
}

/// Retrieve recent history for a repository
pub fn get_repo_history(project_root: &Path, limit: usize) -> Result<Vec<ChangeEvent>> {
    let conn = init_repo_db(project_root)?;

    let mut stmt = conn.prepare(
        "SELECT json_data FROM file_history 
         ORDER BY timestamp DESC 
         LIMIT ?1",
    )?;

    let iter = stmt.query_map([limit], |row| {
        let json: String = row.get(0)?;
        Ok(json)
    })?;

    let mut changes = Vec::new();
    for json_result in iter {
        if let Ok(json) = json_result {
            if let Ok(change) = serde_json::from_str::<ChangeEvent>(&json) {
                changes.push(change);
            }
        }
    }

    Ok(changes)
}
