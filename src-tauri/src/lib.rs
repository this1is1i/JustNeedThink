mod cli;
mod commands;
mod credit;
mod db;
mod error;
mod filesystem;
mod project;
mod session;
mod stream;
mod utils;

use cli::process_manager::ProcessManager;
use cli::stdin_manager::StdinManager;
use cli::resolver::CliBinary;
use credit::tracker::CreditTracker;
use db::schema;
use filesystem::watcher::WatcherManager;
use rusqlite::Connection;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex as TokioMutex;

// --- App State ---

pub struct AppState {
    pub process_manager: ProcessManager,
    pub stdin_manager: StdinManager,
    pub cli_binary: TokioMutex<Option<CliBinary>>,
    pub db: Arc<TokioMutex<Connection>>,
    pub watcher_manager: WatcherManager,
    pub credit_tracker: CreditTracker,
}

impl AppState {
    pub fn new(db: Connection) -> Self {
        Self {
            process_manager: ProcessManager::new(),
            stdin_manager: StdinManager::new(),
            cli_binary: TokioMutex::new(None),
            db: Arc::new(TokioMutex::new(db)),
            watcher_manager: WatcherManager::new(),
            credit_tracker: CreditTracker::new(),
        }
    }
}

// --- Filesystem Commands ---

#[tauri::command]
fn read_file_tree(path: String, depth: Option<u32>) -> Result<Vec<filesystem::tree::FileNode>, String> {
    filesystem::tree::read_file_tree(&path, depth.unwrap_or(3))
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    filesystem::ops::read_file_content(&path)
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    filesystem::ops::write_file_content(&path, &content)
}

#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<(), String> {
    filesystem::ops::copy_file(&src, &dest)
}

#[tauri::command]
fn rename_file(src: String, dest: String) -> Result<(), String> {
    filesystem::ops::rename_file(&src, &dest)
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    filesystem::ops::delete_file(&path)
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    filesystem::ops::create_directory(&path)
}

#[tauri::command]
fn get_file_size(path: String) -> Result<u64, String> {
    filesystem::ops::get_file_size(&path)
}

#[tauri::command]
async fn watch_directory(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    state.watcher_manager.watch_directory(app, path).await
}

#[tauri::command]
async fn unwatch_directory(state: State<'_, AppState>, path: String) -> Result<(), String> {
    state.watcher_manager.unwatch_directory(&path).await;
    Ok(())
}

// --- Database Commands ---

#[tauri::command]
async fn list_db_sessions(state: State<'_, AppState>) -> Result<Vec<db::session_repo::SessionRecord>, String> {
    let db = state.db.lock().await;
    db::session_repo::list_sessions(&db)
}

#[tauri::command]
async fn upsert_db_session(
    state: State<'_, AppState>,
    session: db::session_repo::SessionRecord,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db::session_repo::upsert_session(&db, &session)
}

#[tauri::command]
async fn delete_db_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().await;
    db::session_repo::delete_session(&db, &id)
}

#[tauri::command]
async fn get_db_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().await;
    db::session_repo::get_setting(&db, &key)
}

#[tauri::command]
async fn set_db_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let db = state.db.lock().await;
    db::session_repo::set_setting(&db, &key, &value)
}

// --- Project Commands ---

#[tauri::command]
async fn list_projects(state: State<'_, AppState>) -> Result<Vec<project::registry::ProjectInfo>, String> {
    let db = state.db.lock().await;
    db::project_repo::list_projects(&db)
}

#[tauri::command]
async fn create_project(state: State<'_, AppState>, name: String, path: String) -> Result<project::registry::ProjectInfo, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let proj = project::registry::create_project(&id, &name, &path);
    let db = state.db.lock().await;
    db::project_repo::upsert_project(&db, &proj)?;
    project::workspace::ensure_workspace(&path)?;
    Ok(proj)
}

#[tauri::command]
async fn remove_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().await;
    db::project_repo::delete_project(&db, &id)
}

#[tauri::command]
async fn touch_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().await;
    db::project_repo::touch_project(&db, &id)
}

#[tauri::command]
async fn list_project_sessions(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<db::session_repo::SessionRecord>, String> {
    let db = state.db.lock().await;
    // Reuse list_sessions but filter by project
    let all = db::session_repo::list_sessions(&db)?;
    Ok(all.into_iter().filter(|s| s.project_id.as_deref() == Some(&project_id)).collect())
}

// --- Credit Commands ---

#[tauri::command]
async fn get_credit_summary(state: State<'_, AppState>) -> Result<credit::tracker::CreditSummary, String> {
    Ok(state.credit_tracker.get_summary().await)
}

#[tauri::command]
async fn get_credit_history(state: State<'_, AppState>) -> Result<Vec<credit::usage_stats::DailyUsage>, String> {
    let _ = state;
    Ok(credit::usage_stats::get_daily_history())
}

// --- Commands ---

#[tauri::command]
fn list_builtin_commands() -> Result<Vec<commands::builtin::BuiltinCommand>, String> {
    Ok(commands::builtin::list_builtin_commands())
}

// --- Run ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = schema::open_database().expect("Failed to open database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new(db))
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            log::info!("JustNeedThink started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Session
            session::lifecycle::check_claude_cli,
            session::lifecycle::start_claude_session,
            session::lifecycle::send_stdin,
            session::lifecycle::kill_session,
            session::lifecycle::list_active_processes,
            // Filesystem
            read_file_tree,
            read_file_content,
            write_file_content,
            copy_file,
            rename_file,
            delete_file,
            create_directory,
            get_file_size,
            watch_directory,
            unwatch_directory,
            // Database
            list_db_sessions,
            upsert_db_session,
            delete_db_session,
            get_db_setting,
            set_db_setting,
            // Projects
            list_projects,
            create_project,
            remove_project,
            touch_project,
            list_project_sessions,
            // Credit
            get_credit_summary,
            get_credit_history,
            // Commands
            list_builtin_commands,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
