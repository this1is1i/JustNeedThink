mod cli;
mod db;
mod error;
mod filesystem;
mod stream;
mod utils;

use tauri::Manager;

/// Tauri command: greet
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! JustNeedThink is ready.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            log::info!("JustNeedThink started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
