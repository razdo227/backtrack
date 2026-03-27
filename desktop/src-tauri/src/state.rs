use backtrack_parser::{AbletonProject, ProjectDiff};
use chrono::{DateTime, Utc};
use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub watched_folders: Arc<Mutex<Vec<PathBuf>>>,
    pub watchers: Arc<Mutex<HashMap<PathBuf, RecommendedWatcher>>>,
    pub debounce_tasks: Arc<Mutex<HashMap<PathBuf, DebouncedTask>>>,
    pub last_hashes: Arc<Mutex<HashMap<PathBuf, String>>>,
    pub last_parsed: Arc<Mutex<HashMap<PathBuf, AbletonProject>>>,
    pub recent_changes: Arc<Mutex<VecDeque<ChangeEvent>>>,
}

/// A debounced parse task
pub struct DebouncedTask {
    pub cancel_token: CancellationToken,
    #[allow(dead_code)]
    pub handle: JoinHandle<()>,
}

/// A change event for the recent changes list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    pub file_path: String,
    pub file_name: String,
    pub timestamp: DateTime<Utc>,
    pub summary: String,
    pub track_count: usize,
    pub device_count: usize,
    pub file_hash: Option<String>,
    /// Diff from previous version (if available)
    pub diff: Option<ProjectDiff>,
    /// Human-readable diff summary
    pub diff_summary: Option<String>,
}

/// Settings stored in tauri-plugin-store
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub watched_folders: Vec<String>,
    pub debounce_delay_secs: u64,
    pub show_notifications: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            watched_folders: Vec::new(),
            debounce_delay_secs: 30,
            show_notifications: true,
        }
    }
}

impl ChangeEvent {
    /// Create a ChangeEvent from a project, optionally diffing against a previous version
    pub fn from_project(
        path: PathBuf,
        project: &AbletonProject,
        file_hash: &str,
        previous_project: Option<&AbletonProject>,
    ) -> Self {
        let device_count: usize = project.tracks.iter().map(|t| t.devices.len()).sum();

        // Calculate diff if we have a previous version
        let (diff, diff_summary) = if let Some(old) = previous_project {
            let project_diff = backtrack_parser::diff_projects(old, project);

            if !project_diff.is_empty() {
                let summary = project_diff.to_summary();
                (Some(project_diff), Some(summary))
            } else {
                (None, None)
            }
        } else {
            (None, Some("Initial version".to_string()))
        };

        // Generate summary based on diff or basic stats
        let summary = if let Some(ref diff) = diff {
            // Create concise summary from diff
            let mut parts = Vec::new();
            if !diff.tracks_added.is_empty() {
                parts.push(format!(
                    "+{} track{}",
                    diff.tracks_added.len(),
                    if diff.tracks_added.len() == 1 {
                        ""
                    } else {
                        "s"
                    }
                ));
            }
            if !diff.tracks_removed.is_empty() {
                parts.push(format!(
                    "-{} track{}",
                    diff.tracks_removed.len(),
                    if diff.tracks_removed.len() == 1 {
                        ""
                    } else {
                        "s"
                    }
                ));
            }
            if !diff.tracks_modified.is_empty() {
                parts.push(format!("~{} modified", diff.tracks_modified.len()));
            }
            parts.join(", ")
        } else {
            format!("{} tracks, {} devices", project.tracks.len(), device_count)
        };

        Self {
            file_name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            file_path: path.display().to_string(),
            timestamp: Utc::now(),
            summary,
            track_count: project.tracks.len(),
            device_count,
            file_hash: Some(file_hash.to_string()),
            diff,
            diff_summary,
        }
    }
}
