mod cli;
mod db;
mod error;
mod filesystem;
mod session;
mod stream;
mod utils;

use session::lifecycle::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            log::info!("JustNeedThink started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session::lifecycle::check_claude_cli,
            session::lifecycle::start_claude_session,
            session::lifecycle::send_stdin,
            session::lifecycle::kill_session,
            session::lifecycle::list_active_processes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
