use crate::state::{AppState, ChangeEvent, DebouncedTask};
use crate::utils;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::panic::{self, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

const DEBOUNCE_DELAY_SECS: u64 = 5; // Increased to handle Ableton's multi-step saves
const MAX_RECENT_CHANGES: usize = 50;
const DUPLICATE_WINDOW_SECS: i64 = 10; // Consider same file within 10 seconds as duplicate

pub async fn start_watching_folder(
    folder: PathBuf,
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    info!("Starting watcher for folder: {:?}", folder);

    if !folder.exists() {
        return Err(format!("Folder does not exist: {}", folder.display()));
    }

    if !folder.is_dir() {
        return Err(format!("Path is not a directory: {}", folder.display()));
    }

    let folder_clone = folder.clone();
    let app_clone = app_handle.clone();

    let watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                handle_fs_event(event, app_clone.clone());
            }
            Err(e) => {
                error!("File watcher error: {}", e);
                let _ = app_clone.emit(
                    "watcher-error",
                    serde_json::json!({
                        "error": e.to_string(),
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }),
                );
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Store watcher before starting (prevents drop)
    let mut watchers = state.watchers.lock().await;
    watchers.insert(folder.clone(), watcher);

    // Now start watching
    let watcher = watchers.get_mut(&folder).unwrap();
    watcher
        .watch(&folder_clone, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch folder: {}", e))?;

    info!("Successfully started watching: {:?}", folder);

    // Also add to watched_folders list
    let mut watched = state.watched_folders.lock().await;
    if !watched.contains(&folder) {
        watched.push(folder);
    }

    Ok(())
}

pub async fn stop_watching_folder(
    folder: &Path,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    info!("Stopping watcher for folder: {:?}", folder);

    // Remove watcher (drop will stop watching)
    let mut watchers = state.watchers.lock().await;
    watchers.remove(folder);

    // Remove from watched folders
    let mut watched = state.watched_folders.lock().await;
    watched.retain(|p| p != folder);

    // Cancel any pending debounce tasks for files in this folder
    let mut tasks = state.debounce_tasks.lock().await;
    tasks.retain(|path, task| {
        if path.starts_with(folder) {
            task.cancel_token.cancel();
            false
        } else {
            true
        }
    });

    Ok(())
}

fn handle_fs_event(event: Event, app_handle: AppHandle) {
    // Filter for .als files only (excluding backups and temp files)
    let als_paths: Vec<PathBuf> = event
        .paths
        .iter()
        .filter(|p| {
            p.extension().and_then(|s| s.to_str()) == Some("als")
                && !is_temp_file(p)
                && !is_backup_file(p)
        })
        .cloned()
        .collect();

    if als_paths.is_empty() {
        return;
    }

    // Only process modify/create events
    match event.kind {
        EventKind::Modify(notify::event::ModifyKind::Data(_)) | EventKind::Create(_) => {
            for path in als_paths {
                debug!("Detected change in .als file: {:?}", path);

                // Emit immediate event
                let _ = app_handle.emit(
                    "file-changed",
                    serde_json::json!({
                        "path": path.display().to_string(),
                        "status": "detected",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }),
                );

                // Start debounced parse
                let app_clone = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    start_debounced_parse(path, app_clone).await;
                });
            }
        }
        _ => {
            // Ignore other events (rename, delete, metadata)
        }
    }
}

async fn start_debounced_parse(path: PathBuf, app_handle: AppHandle) {
    if is_backup_file(&path) {
        debug!("Skipping backup file change: {:?}", path);
        return;
    }

    let state = app_handle.state::<AppState>();

    // Cancel existing task for this file
    {
        let mut tasks = state.debounce_tasks.lock().await;
        if let Some(task) = tasks.remove(&path) {
            debug!("Cancelling existing debounce task for {:?}", path);
            task.cancel_token.cancel();
            // Task will clean itself up
        }
    }

    // Create new cancellation token
    let cancel_token = CancellationToken::new();
    let cancel_clone = cancel_token.clone();
    let path_clone = path.clone();
    let app_clone = app_handle.clone();

    // Spawn debounce task
    let handle = tokio::spawn(async move {
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(DEBOUNCE_DELAY_SECS)) => {
                debug!("Debounce timer expired for {:?}", path_clone);

                // Timer expired, parse the file
                parse_and_emit(&path_clone, &app_clone).await;

                // Remove self from tasks map
                let state = app_clone.state::<AppState>();
                let mut tasks = state.debounce_tasks.lock().await;
                tasks.remove(&path_clone);
            }
            _ = cancel_clone.cancelled() => {
                debug!("Debounce task cancelled for {:?}", path_clone);
            }
        }
    });

    // Store task
    let mut tasks = state.debounce_tasks.lock().await;
    tasks.insert(
        path.clone(),
        DebouncedTask {
            cancel_token,
            handle,
        },
    );

    debug!("Started debounce task for {:?}", path);
}

async fn parse_and_emit(path: &Path, app_handle: &AppHandle) {
    if is_backup_file(path) {
        debug!("Ignoring backup file parse attempt: {:?}", path);
        return;
    }

    info!("⚡ [PARSE] Starting parse for: {:?}", path);

    let state = app_handle.state::<AppState>();

    // Check if file actually changed via hash
    let new_hash = match utils::hash_file(path).await {
        Ok(h) => h,
        Err(e) => {
            warn!("Failed to hash file {:?}: {}", path, e);
            return;
        }
    };

    info!("🔑 [HASH] New hash: {}", &new_hash[..8]);

    // Atomically check and update hash to prevent race conditions
    let should_parse = {
        let mut hashes = state.last_hashes.lock().await;
        let old_hash = hashes.get(path);

        info!(
            "🔍 [HASH] Old hash: {}",
            old_hash.map(|h| &h[..8]).unwrap_or("NONE")
        );

        // Check if hash changed
        let changed = old_hash.map(|old| old != &new_hash).unwrap_or(true);

        if changed {
            info!("✅ [HASH] Hash changed, will parse");
            // Update hash immediately while we still hold the lock
            hashes.insert(path.to_path_buf(), new_hash.clone());
        } else {
            info!("⏭️  [HASH] Hash unchanged, skipping");
        }

        changed
    };

    if !should_parse {
        debug!("File hash unchanged, skipping parse: {:?}", path);
        return;
    }

    // Emit parsing status
    let _ = app_handle.emit(
        "file-parsing",
        serde_json::json!({
            "path": path.display().to_string(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }),
    );

    // Get previous version for diffing
    let previous_project = {
        let last_parsed = state.last_parsed.lock().await;
        let prev = last_parsed.get(path).cloned();
        info!(
            "📚 [CACHE] Previous version: {}",
            if prev.is_some() { "FOUND" } else { "NONE" }
        );
        prev
    };

    // Parse file
    match backtrack_parser::parse_file(path) {
        Ok(project) => {
            info!(
                "Successfully parsed {:?}: {} tracks, version {}.{}",
                path,
                project.tracks.len(),
                project.version.major,
                project.version.minor
            );

            // Create change event with diff from previous version
            let change = ChangeEvent::from_project(
                path.to_path_buf(),
                &project,
                &new_hash,
                previous_project.as_ref(),
            );

            info!(
                "📊 [DIFF] Diff: {}, Summary: {}",
                if change.diff.is_some() {
                    "PRESENT"
                } else {
                    "NONE"
                },
                change.diff_summary.as_ref().unwrap_or(&"NONE".to_string())
            );

            // Only add to recent changes if there's an actual diff
            // Skip initial versions (no previous project) - they're not "changes"
            let should_add = change.diff.is_some();

            info!(
                "💾 [ADD] Should add: {} (diff: {}, prev: {})",
                should_add,
                if change.diff.is_some() { "YES" } else { "NO" },
                if previous_project.is_some() {
                    "YES"
                } else {
                    "NO"
                }
            );

            if should_add {
                let mut recent = state.recent_changes.lock().await;

                info!("📝 [RECENT] Before merge: {} entries", recent.len());

                // Check for recent changes to same file and merge them
                // Ableton often writes files multiple times during one save operation
                let now = chrono::Utc::now();
                let mut removed_count = 0;

                // Remove any recent entries for the same file (within duplicate window)
                // This merges consecutive saves into one entry (keeping the latest)
                recent.retain(|existing| {
                    if existing.file_path != change.file_path {
                        return true; // Keep entries for different files
                    }

                    let time_diff = (now - existing.timestamp).num_seconds();
                    let within_window = time_diff < DUPLICATE_WINDOW_SECS;

                    info!(
                        "🔍 [MERGE] Comparing: same file, time_diff={}s, within_window={}",
                        time_diff, within_window
                    );

                    if within_window {
                        info!(
                            "🗑️  [MERGE] Removing duplicate entry for {:?} ({}s ago)",
                            path, time_diff
                        );
                        removed_count += 1;
                        false // Remove this old entry, we'll add the new one
                    } else {
                        true // Keep entries outside the window
                    }
                });

                info!(
                    "✨ [MERGE] Removed {} duplicates, adding new entry",
                    removed_count
                );

                // Add the new change (replacing any removed duplicates)
                recent.push_front(change.clone());
                if recent.len() > MAX_RECENT_CHANGES {
                    recent.pop_back();
                }

                info!("📝 [RECENT] After merge: {} entries", recent.len());
            } else {
                info!(
                    "⏭️  [SKIP] No changes detected for {:?}, skipping change event",
                    path
                );
            }

            // Cache parsed result
            {
                let mut last_parsed = state.last_parsed.lock().await;
                last_parsed.insert(path.to_path_buf(), project.clone());
            }

            // Log change to persistent DB
            // Find project root (assume it's one of the watched folders? Or search upwards?)
            // For now, let's assume the watched folder IS the project root if it contains .git or .backtrack
            // Or simpler: we parse the project, we know where the .als is. Usually the .als is at the root or deeper.
            // We should search upwards for the closest watched folder or just the .als directory?
            // "Repository" definition: A tracked folder.
            // When we start_watching_folder(path), THAT is the root.

            // To find the repo root, we need access to the list of watched folders or pass it down.
            // HACK: For MVP, we'll try to initialize the DB in the parent directory of the .als file
            // OR look up which watched folder contains this file.

            if let Some(repo_root) = find_repo_root(path, &state) {
                if let Err(e) = crate::db::log_change(&repo_root, &change) {
                    error!("Failed to log change to DB: {}", e);
                }
            } else {
                // Fallback: use .als directory as root?
                // warning!("Could not assist repository root for {:?}, using parent dir", path);
                if let Some(parent) = path.parent() {
                    if let Err(e) = crate::db::log_change(parent, &change) {
                        error!("Failed to log change to fallback DB in {:?}: {}", parent, e);
                    }
                }
            }

            // Emit success event
            let _ = app_handle.emit(
                "file-parsed",
                serde_json::json!({
                    "path": path.display().to_string(),
                    "project": project,
                    "change": change,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }),
            );

            // Show notification if enabled
            send_notification(app_handle, &change);
        }
        Err(e) => {
            error!("Failed to parse {:?}: {}", path, e);

            let _ = app_handle.emit(
                "parse-error",
                serde_json::json!({
                    "path": path.display().to_string(),
                    "error": e.to_string(),
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }),
            );
        }
    }
}

fn is_temp_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|name| {
            name.starts_with('.')
                || name.starts_with('~')
                || name.contains(".tmp")
                || name.contains("~lock")
        })
        .unwrap_or(false)
}

fn is_backup_file(path: &Path) -> bool {
    // Check if any path component contains "backup" (case-insensitive) to filter Ableton backups
    path.iter().any(|component| {
        component
            .to_string_lossy()
            .to_ascii_lowercase()
            .contains("backup")
    })
}

fn send_notification(app_handle: &AppHandle, change: &ChangeEvent) {
    let body = format!("{}: {}", change.file_name, change.summary);

    // Guard against any panics inside the notification plugin
    let notify_result = panic::catch_unwind(AssertUnwindSafe(|| {
        app_handle
            .notification()
            .builder()
            .title("Backtrack")
            .body(body)
            .show()
    }));

    match notify_result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!("Failed to show notification: {}", e),
        Err(e) => warn!("Notification thread panicked: {:?}", e),
    }
}

/// Helper to find the "repository root" for a given file path.
/// It checks if the file is inside one of the watched folders.
fn find_repo_root(path: &Path, _state: &AppState) -> Option<PathBuf> {
    // We need to access the watched folders list.
    // Since AppState needs async lock, we try to get it synchronously if possible,
    // or we just search upwards for significant markers if we can't lock easily here (which we can't easily do sync).

    // BETTER APPROACH: The `start_debounced_parse` is async.
    // `parse_and_emit` is async (it takes &AppState).
    // So we CAN lock the state.

    // However, `find_repo_root` in my previous edit was called as if sync.
    // Let's rely on `state` passed to `parse_and_emit`.
    // Wait, `parse_and_emit` receives `&AppHandle`, so it can get state.

    // We can't easily lock async mutex in a closure if we are not careful.
    // But `parse_and_emit` is `async fn`.

    // Let's implement a simple heuristic first: search up for `.backtrack` or return parent.
    // Ideally, we iterate through `state.watched_folders`.

    // NOTE: This implementation assumes we are inside an async context or can block.
    // But actually, `find_repo_root` call site in my previous edit was inside `parse_and_emit` which IS async.
    // So we can use `state.watched_folders.lock().await` if we change the signature.
    // But `find_repo_root` signature in my previous edit `fn find_repo_root(path: &Path, state: &AppState)` suggests sync.
    // Let's implement it to just look for existing markers first to avoid lock contention?
    // No, reliance on markers is bad if they don't exist yet.

    // Let's change the call site in `parse_and_emit` to pass the locked list?
    // Or just make `find_repo_root` not take state and just walk up?
    // Walking up is safer "Git behavior".

    // Strategy: Walk up parent directories. If we find `.backtrack` or `.git`, that's the root.
    // If we hit root without finding one, return None (or handle fallback at call site).
    let mut current = path.parent();
    while let Some(dir) = current {
        if dir.join(".backtrack").exists() || dir.join(".git").exists() {
            return Some(dir.to_path_buf());
        }
        current = dir.parent();
    }
    None
}
