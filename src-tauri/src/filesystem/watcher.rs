use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Manages file system watchers for multiple directories.
#[derive(Default)]
pub struct WatcherManager {
    watchers: Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>,
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start watching a directory. Emits `fs:change` events.
    pub async fn watch_directory(
        &self,
        app: AppHandle,
        root_path: String,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        // Remove existing watcher for this path
        watchers.remove(&root_path);

        let app_clone = app.clone();
        let path_clone = root_path.clone();

        let mut watcher = notify::recommended_watcher(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let kind = match event.kind {
                        EventKind::Create(_) => "created",
                        EventKind::Modify(_) => "modified",
                        EventKind::Remove(_) => "removed",
                        _ => return,
                    };

                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.display().to_string())
                        .collect();

                    let _ = app_clone.emit(
                        "fs:change",
                        serde_json::json!({
                            "kind": kind,
                            "paths": paths,
                            "root": &path_clone,
                        }),
                    );
                }
            },
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&PathBuf::from(&root_path), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        watchers.insert(root_path, watcher);
        Ok(())
    }

    /// Stop watching a directory.
    pub async fn unwatch_directory(&self, root_path: &str) {
        let mut watchers = self.watchers.lock().await;
        watchers.remove(root_path);
    }
}
