#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backtrack_init;
mod commands;
mod db;
mod file_watcher;
mod state;
mod tray;
mod utils;

use state::AppState;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn setup_logging() {
    // Log to both file and stdout
    let log_dir = dirs::home_dir()
        .unwrap_or_default()
        .join("Library/Logs/Backtrack");

    std::fs::create_dir_all(&log_dir).ok();

    let file_appender = tracing_appender::rolling::daily(log_dir, "backtrack.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(
            fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false)
                .with_target(true),
        )
        .with(fmt::layer().with_writer(std::io::stdout).with_target(false))
        .with(
            EnvFilter::from_default_env()
                .add_directive("backtrack=debug".parse().unwrap())
                .add_directive("tauri=info".parse().unwrap())
                .add_directive("notify=info".parse().unwrap()),
        )
        .init();

    // Prevent guard from being dropped
    std::mem::forget(_guard);
}

#[tokio::main]
async fn main() {
    setup_logging();

    tracing::info!("Starting Backtrack Desktop v{}", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            tracing::info!("Setting up Tauri application");

            // Set activation policy to make this a menubar-only app (no Dock icon)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Initialize app state
            let state = AppState {
                watched_folders: Arc::new(Mutex::new(Vec::new())),
                watchers: Arc::new(Mutex::new(HashMap::new())),
                debounce_tasks: Arc::new(Mutex::new(HashMap::new())),
                last_hashes: Arc::new(Mutex::new(HashMap::new())),
                last_parsed: Arc::new(Mutex::new(HashMap::new())),
                recent_changes: Arc::new(Mutex::new(VecDeque::new())),
            };

            app.manage(state);

            // Setup system tray
            tray::setup_tray(app)?;

            // Load saved settings asynchronously
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Small delay to ensure frontend is ready
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                if let Err(e) = commands::load_settings(app_handle.clone()).await {
                    tracing::error!("Failed to load settings: {}", e);
                } else {
                    tracing::info!("Settings loaded successfully");
                    // Emit event to notify frontend that settings are loaded
                    let _ = app_handle.emit("settings-loaded", ());
                }
            });

            tracing::info!("Tauri application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_watched_folder,
            commands::get_watched_folders,
            commands::remove_watched_folder,
            commands::clear_all_watched_folders,
            commands::parse_file_now,
            commands::get_recent_changes,
            commands::clear_recent_changes,
            commands::get_file_details,
            commands::scan_for_projects,
            commands::get_projects_overview,
            commands::initialize_projects,
            commands::debug_clear_initialization_data,
            commands::get_project_metadata,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide instead of close (menubar app behavior)
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
