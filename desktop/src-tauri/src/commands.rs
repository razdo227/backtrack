use crate::file_watcher;
use crate::state::{AppSettings, AppState, ChangeEvent};
use backtrack_parser::AbletonProject;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_store::StoreExt;
use walkdir::WalkDir;

use tracing::{error, info};

const SETTINGS_KEY: &str = "settings.json";

#[tauri::command]
pub async fn add_watched_folder(
    folder: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Adding watched folder: {}", folder);

    let path = PathBuf::from(&folder);

    if !path.exists() {
        error!("Folder does not exist: {}", folder);
        return Err("Folder does not exist".to_string());
    }

    if !path.is_dir() {
        error!("Path is not a directory: {}", folder);
        return Err("Path is not a directory".to_string());
    }

    // Check if already watching
    {
        let watched = state.watched_folders.lock().await;
        if watched.contains(&path) {
            error!("Folder is already being watched: {}", folder);
            return Err("Folder is already being watched".to_string());
        }
    }

    // Start watching
    match file_watcher::start_watching_folder(path.clone(), app.clone(), state.clone()).await {
        Ok(_) => info!("File watcher started successfully for: {}", folder),
        Err(e) => {
            error!("Failed to start file watcher for {}: {}", folder, e);
            return Err(e);
        }
    }

    // Save settings
    match save_settings(app).await {
        Ok(_) => info!("Settings saved successfully"),
        Err(e) => {
            error!("Failed to save settings: {}", e);
            return Err(e);
        }
    }

    info!("Successfully added watched folder: {}", folder);
    Ok(())
}

#[tauri::command]
pub async fn get_watched_folders(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let folders = state.watched_folders.lock().await;
    Ok(folders.iter().map(|p| p.display().to_string()).collect())
}

#[tauri::command]
pub async fn remove_watched_folder(
    folder: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Removing watched folder: {}", folder);

    let path = PathBuf::from(&folder);

    file_watcher::stop_watching_folder(&path, state.clone()).await?;

    // Save settings
    save_settings(app).await?;

    info!("Successfully removed watched folder: {}", folder);
    Ok(())
}

#[tauri::command]
pub async fn parse_file_now(path: String) -> Result<AbletonProject, String> {
    info!("Manual parse requested for: {}", path);

    backtrack_parser::parse_file(&path).map_err(|e| {
        error!("Parse failed for {}: {}", path, e);
        format!("Parse error: {}", e)
    })
}

#[tauri::command]
pub async fn get_recent_changes(state: State<'_, AppState>) -> Result<Vec<ChangeEvent>, String> {
    // For MVP, we aggregate history from all watched folders
    // In a real app, this should be paginated or per-project
    let folders = state.watched_folders.lock().await;

    let mut all_changes = Vec::new();

    for folder in folders.iter() {
        if let Ok(changes) = crate::db::get_repo_history(folder, 50) {
            all_changes.extend(changes);
        }
    }

    // Sort by timestamp desc
    all_changes.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Limit global list
    Ok(all_changes.into_iter().take(50).collect())
}

#[tauri::command]
pub async fn clear_recent_changes(state: State<'_, AppState>) -> Result<(), String> {
    let mut recent = state.recent_changes.lock().await;
    recent.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_file_details(
    path: String,
    state: State<'_, AppState>,
) -> Result<Option<AbletonProject>, String> {
    let last_parsed = state.last_parsed.lock().await;
    Ok(last_parsed.get(&PathBuf::from(path)).cloned())
}

#[tauri::command]
pub async fn clear_all_watched_folders(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Clearing all watched folders");

    // Get list of all folders to stop watching
    let folders_to_remove: Vec<PathBuf> = {
        let watched = state.watched_folders.lock().await;
        watched.clone()
    };

    // Stop watching each folder
    for folder in folders_to_remove {
        if let Err(e) = file_watcher::stop_watching_folder(&folder, state.clone()).await {
            error!("Failed to stop watching {:?}: {}", folder, e);
        }
    }

    // Save empty settings
    save_settings(app).await?;

    info!("All watched folders cleared");
    Ok(())
}

// Settings management

#[tauri::command]
pub async fn scan_for_projects(path: String) -> Result<Vec<String>, String> {
    info!("Scanning for projects in: {}", path);

    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err("Invalid directory".to_string());
    }

    // Run blocking scan in a separate thread to avoid blocking async runtime
    let projects = tokio::task::spawn_blocking(move || {
        let mut project_dirs = Vec::new();

        // Only scan level 1 subdirectories (immediate children of root)
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();

                // Only process directories
                if !path.is_dir() {
                    continue;
                }

                // Skip hidden folders and backup folders
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.')
                        || name_str.eq_ignore_ascii_case("backup")
                        || name_str.eq_ignore_ascii_case("backups")
                    {
                        continue;
                    }
                }

                // Check if this directory contains at least one .als file (at any depth)
                let contains_als = WalkDir::new(&path)
                    .follow_links(true)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .any(|e| {
                        e.path()
                            .extension()
                            .map(|ext| ext == "als")
                            .unwrap_or(false)
                    });

                if contains_als {
                    project_dirs.push(path.to_string_lossy().to_string());
                }
            }
        }

        project_dirs.sort();
        project_dirs
    })
    .await
    .map_err(|e| e.to_string())?;

    info!("Found {} projects", projects.len());
    Ok(projects)
}

#[derive(serde::Serialize)]
pub struct ProjectOverview {
    path: String,
    name: String,
    dir_modified_ms: Option<i64>,
    has_backtrack_file: bool,
}

fn system_time_to_epoch_ms(time: SystemTime) -> Option<i64> {
    let duration = time.duration_since(UNIX_EPOCH).ok()?;
    duration.as_millis().try_into().ok()
}

fn most_recent_als_modified_ms(project_root: &Path) -> Option<i64> {
    let entries = std::fs::read_dir(project_root).ok()?;
    let mut newest: Option<i64> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        match path.extension().and_then(|ext| ext.to_str()) {
            Some(ext) if ext.eq_ignore_ascii_case("als") => {}
            _ => continue,
        }

        let modified_ms = std::fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(system_time_to_epoch_ms);

        if let Some(modified_ms) = modified_ms {
            newest = Some(newest.map_or(modified_ms, |current| current.max(modified_ms)));
        }
    }

    newest
}

#[tauri::command]
pub async fn get_projects_overview(paths: Vec<String>) -> Result<Vec<ProjectOverview>, String> {
    tokio::task::spawn_blocking(move || {
        let mut out = Vec::with_capacity(paths.len());

        for path in paths {
            let project_path = PathBuf::from(&path);

            let name = project_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&path)
                .to_string();

            // Directory mtime typically doesn't change when an `.als` file is modified (only when
            // directory entries change). Prefer the most recent `.als` mtime for "Modified" sort.
            let dir_modified_ms = most_recent_als_modified_ms(&project_path).or_else(|| {
                std::fs::metadata(&project_path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(system_time_to_epoch_ms)
            });

            let has_backtrack_file = crate::backtrack_init::has_init_file(&project_path);

            out.push(ProjectOverview {
                path,
                name,
                dir_modified_ms,
                has_backtrack_file,
            });
        }

        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct InitProjectsResult {
    created: usize,
    already_initialized: usize,
    failed: Vec<InitProjectFailure>,
}

#[derive(serde::Serialize)]
pub struct InitProjectFailure {
    path: String,
    error: String,
}

#[tauri::command]
pub async fn initialize_projects(project_paths: Vec<String>) -> Result<InitProjectsResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut created = 0usize;
        let mut already_initialized = 0usize;
        let mut failed = Vec::new();

        for path in project_paths {
            let project_path = PathBuf::from(&path);
            if !project_path.is_dir() {
                failed.push(InitProjectFailure {
                    path,
                    error: "Not a directory".to_string(),
                });
                continue;
            }

            match crate::backtrack_init::ensure_init_file(&project_path) {
                Ok(true) => created += 1,
                Ok(false) => already_initialized += 1,
                Err(e) => failed.push(InitProjectFailure {
                    path,
                    error: e.to_string(),
                }),
            }
        }

        Ok(InitProjectsResult {
            created,
            already_initialized,
            failed,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn debug_clear_initialization_data(state: State<'_, AppState>) -> Result<usize, String> {
    let watched_roots: Vec<PathBuf> = { state.watched_folders.lock().await.clone() };

    tokio::task::spawn_blocking(move || {
        let mut removed = 0usize;

        for root in watched_roots {
            // If user accidentally watched a project folder directly.
            if let Ok(true) = crate::backtrack_init::remove_backtrack_dir(&root) {
                removed += 1;
            }

            let entries = match std::fs::read_dir(&root) {
                Ok(entries) => entries,
                Err(_) => continue,
            };

            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.')
                        || name_str.eq_ignore_ascii_case("backup")
                        || name_str.eq_ignore_ascii_case("backups")
                    {
                        continue;
                    }
                }

                match crate::backtrack_init::remove_backtrack_dir(&path) {
                    Ok(true) => removed += 1,
                    Ok(false) => {}
                    Err(e) => {
                        error!("Failed to remove .backtrack for {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(removed)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct ProjectMetadata {
    last_modified: String,
    ableton_version: Option<String>,
    available_versions: Vec<String>,
}

#[tauri::command]
pub async fn get_project_metadata(project_path: String) -> Result<ProjectMetadata, String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() || !path.is_dir() {
        return Err("Invalid project path".to_string());
    }

    // Run blocking operations in a separate thread
    tokio::task::spawn_blocking(move || {
        // Get last modified time by finding the most recent .als file
        let mut last_modified = String::from("Unknown");
        let mut ableton_version: Option<String> = None;
        let mut available_versions = Vec::new();

        let entries = WalkDir::new(&path)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext == "als")
                    .unwrap_or(false)
            })
            .collect::<Vec<_>>();

        if !entries.is_empty() {
            // Sort by modified time
            let mut als_files = entries;
            als_files.sort_by(|a, b| {
                let time_a = a.metadata().ok().and_then(|m| m.modified().ok());
                let time_b = b.metadata().ok().and_then(|m| m.modified().ok());
                time_b.cmp(&time_a) // Descending order (newest first)
            });

            // Get the most recent file
            if let Some(newest) = als_files.first() {
                if let Ok(metadata) = newest.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(duration) = modified.elapsed() {
                            let secs = duration.as_secs();
                            last_modified = if secs < 60 {
                                format!("{} seconds ago", secs)
                            } else if secs < 3600 {
                                format!("{} minutes ago", secs / 60)
                            } else if secs < 86400 {
                                format!("{} hours ago", secs / 3600)
                            } else {
                                format!("{} days ago", secs / 86400)
                            };
                        }
                    }
                }

                // Try to parse Ableton version from the newest file
                if let Ok(project) = backtrack_parser::parse_file(newest.path()) {
                    ableton_version = project.version.creator.clone().or_else(|| {
                        if project.version.minor.is_empty() {
                            None
                        } else {
                            Some(format!("Ableton Live {}", project.version.minor))
                        }
                    });
                }
            }

            // Collect all unique version names from .als files
            for entry in &als_files {
                if let Some(file_name) = entry.file_name().to_str() {
                    // Extract version pattern like "Project v1.als" or "Project_v2.als"
                    if let Some(version) = extract_version_from_filename(file_name) {
                        if !available_versions.contains(&version) {
                            available_versions.push(version);
                        }
                    }
                }
            }

            // If no versions found, check if there's just a main file
            if available_versions.is_empty() && !als_files.is_empty() {
                available_versions.push("main".to_string());
            }
        }

        available_versions.sort();

        Ok(ProjectMetadata {
            last_modified,
            ableton_version,
            available_versions,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn extract_version_from_filename(filename: &str) -> Option<String> {
    // Remove .als extension
    let name = filename.strip_suffix(".als").unwrap_or(filename);

    // Look for patterns like "v1", "v2.1", "version 1", etc.
    let patterns = [
        regex::Regex::new(r"(?i)[_\s-]v(\d+(?:\.\d+)?)").ok()?,
        regex::Regex::new(r"(?i)[_\s-]version[_\s-](\d+(?:\.\d+)?)").ok()?,
    ];

    for pattern in &patterns {
        if let Some(captures) = pattern.captures(name) {
            if let Some(version_num) = captures.get(1) {
                return Some(format!("v{}", version_num.as_str()));
            }
        }
    }

    None
}

pub async fn load_settings(app: AppHandle) -> Result<(), String> {
    info!("Loading settings");

    let store = app
        .store(SETTINGS_KEY)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let settings: AppSettings = store
        .get("app_settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    info!(
        "Loaded settings: {} watched folders",
        settings.watched_folders.len()
    );

    // Start watching saved folders
    let state = app.state::<AppState>();
    for folder in settings.watched_folders {
        let path = PathBuf::from(&folder);
        if path.exists() {
            info!("Restoring watcher for: {}", folder);
            if let Err(e) =
                file_watcher::start_watching_folder(path, app.clone(), state.clone()).await
            {
                error!("Failed to restore watcher for {}: {}", folder, e);
            }
        } else {
            error!("Saved folder no longer exists: {}", folder);
        }
    }

    Ok(())
}

pub async fn save_settings(app: AppHandle) -> Result<(), String> {
    info!("Saving settings");

    let state = app.state::<AppState>();
    let watched = state.watched_folders.lock().await;

    let settings = AppSettings {
        watched_folders: watched.iter().map(|p| p.display().to_string()).collect(),
        debounce_delay_secs: 30,
        show_notifications: true,
    };

    let store = app
        .store(SETTINGS_KEY)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set("app_settings", serde_json::to_value(&settings).unwrap());

    store
        .save()
        .map_err(|e| format!("Failed to persist settings: {}", e))?;

    info!("Settings saved successfully");
    Ok(())
}
