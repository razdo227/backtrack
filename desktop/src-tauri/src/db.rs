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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::ChangeEvent;
    use chrono::Utc;
    use std::fs;
    use std::path::PathBuf;

    fn create_temp_project_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        let unique = format!(
            "backtrack-db-test-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos()
        );
        dir.push(unique);
        fs::create_dir_all(&dir).expect("create temp project dir");
        dir
    }

    fn cleanup_dir(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn log_change_and_restore_history() {
        let project_root = create_temp_project_dir();

        let change = ChangeEvent {
            file_path: "Song.als".to_string(),
            file_name: "Song.als".to_string(),
            timestamp: Utc::now(),
            summary: "1 track".to_string(),
            track_count: 1,
            device_count: 0,
            file_hash: Some("hash".to_string()),
            diff: None,
            diff_summary: Some("Initial version".to_string()),
        };

        log_change(&project_root, &change).expect("log change");

        let db_path = project_root.join(".backtrack").join("db.sqlite");
        assert!(db_path.is_file(), "expected db.sqlite to be created");

        let history = get_repo_history(&project_root, 10).expect("get repo history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].file_path, "Song.als");
        assert_eq!(history[0].summary, "1 track");

        cleanup_dir(&project_root);
    }
}
