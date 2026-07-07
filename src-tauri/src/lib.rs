mod agent;
mod cli;
mod commands;
mod credit;
mod db;
mod skill;
mod workflow;
mod error;
mod filesystem;
mod project;
mod session;
mod stream;
mod utils;

use cli::process_manager::ProcessManager;
use cli::stdin_manager::StdinManager;
use cli::resolver::CliBinary;
use agent::monitor::AgentMonitor;
use agent::message_bus::AgentMessageBus;
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
    pub db: Option<Arc<TokioMutex<Connection>>>,
    pub watcher_manager: WatcherManager,
    pub credit_tracker: CreditTracker,
    pub agent_monitor: AgentMonitor,
    pub agent_bus: AgentMessageBus,
}

impl AppState {
    pub fn new(db: Option<Connection>) -> Self {
        Self {
            process_manager: ProcessManager::new(),
            stdin_manager: StdinManager::new(),
            cli_binary: TokioMutex::new(None),
            db: db.map(|c| Arc::new(TokioMutex::new(c))),
            watcher_manager: WatcherManager::new(),
            credit_tracker: CreditTracker::new(),
            agent_monitor: AgentMonitor::new(),
            agent_bus: AgentMessageBus::new(),
        }
    }

    /// Run a closure with the DB connection, or return a friendly error.
    async fn with_db<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&Connection) -> Result<R, String>,
    {
        let arc = self.db.as_ref()
            .ok_or_else(|| "Database is temporarily unavailable. Your data is safe — restart the app to retry.".to_string())?;
        let db = arc.lock().await;
        f(&db)
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
    state.with_db(|db| db::session_repo::list_sessions(db)).await
}

#[tauri::command]
async fn upsert_db_session(state: State<'_, AppState>, session: db::session_repo::SessionRecord) -> Result<(), String> {
    state.with_db(|db| db::session_repo::upsert_session(db, &session)).await
}

#[tauri::command]
async fn delete_db_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.with_db(|db| db::session_repo::delete_session(db, &id)).await
}

#[tauri::command]
async fn get_db_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.with_db(|db| db::session_repo::get_setting(db, &key)).await
}

#[tauri::command]
async fn set_db_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.with_db(|db| db::session_repo::set_setting(db, &key, &value)).await
}

// --- Project Commands ---

#[tauri::command]
async fn list_projects(state: State<'_, AppState>) -> Result<Vec<project::registry::ProjectInfo>, String> {
    state.with_db(|db| db::project_repo::list_projects(db)).await
}

#[tauri::command]
async fn create_project(state: State<'_, AppState>, name: String, path: String) -> Result<project::registry::ProjectInfo, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let proj = project::registry::create_project(&id, &name, &path);
    state.with_db(|db| db::project_repo::upsert_project(db, &proj)).await?;
    project::workspace::ensure_workspace(&path)?;
    Ok(proj)
}

#[tauri::command]
async fn remove_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.with_db(|db| db::project_repo::delete_project(db, &id)).await
}

#[tauri::command]
async fn touch_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.with_db(|db| db::project_repo::touch_project(db, &id)).await
}

#[tauri::command]
async fn list_project_sessions(state: State<'_, AppState>, project_id: String) -> Result<Vec<db::session_repo::SessionRecord>, String> {
    state.with_db(|db| {
        let all = db::session_repo::list_sessions(db)?;
        Ok(all.into_iter().filter(|s| s.project_id.as_deref() == Some(&project_id)).collect())
    }).await
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

// --- Agent Commands ---

#[tauri::command]
fn list_agents() -> Result<Vec<agent::registry::AgentDefinition>, String> {
    Ok(agent::registry::builtin_agents())
}

#[tauri::command]
fn list_agent_teams() -> Result<Vec<agent::team::AgentTeam>, String> {
    Ok(agent::team::list_default_teams())
}

#[tauri::command]
async fn get_agent_status(state: State<'_, AppState>) -> Result<Vec<agent::monitor::AgentStatus>, String> {
    Ok(state.agent_monitor.list_all().await)
}

#[tauri::command]
async fn clear_agent_monitor(state: State<'_, AppState>) -> Result<(), String> {
    state.agent_monitor.clear().await;
    Ok(())
}

// --- Workflow Commands ---

#[tauri::command]
fn list_workflows() -> Result<Vec<workflow::engine::WorkflowDefinition>, String> {
    Ok(workflow::engine::default_workflows())
}

// --- Skill Commands ---

#[tauri::command]
fn list_skills(project_dir: Option<String>) -> Result<Vec<skill::loader::SkillInfo>, String> {
    Ok(skill::loader::list_skills(project_dir.as_deref()))
}

#[tauri::command]
fn read_skill(path: String) -> Result<String, String> {
    skill::loader::read_skill(&path)
}

#[tauri::command]
fn write_skill(path: String, content: String) -> Result<(), String> {
    skill::loader::write_skill(&path, &content)
}

// --- Run ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = schema::open_database().ok();
    if db.is_none() {
        log::error!("Failed to open SQLite database — running without persistence");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new(db))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                log::info!("JustNeedThink started (window: {:?})", window.title());
            } else {
                log::warn!("Main window not found — app may be running headless");
            }
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
            // Agents
            list_agents,
            list_agent_teams,
            get_agent_status,
            clear_agent_monitor,
            // Workflow
            list_workflows,
            // Skills
            list_skills,
            read_skill,
            write_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
