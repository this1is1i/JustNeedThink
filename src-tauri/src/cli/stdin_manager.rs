use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::ChildStdin;
use tokio::sync::Mutex;

/// Manages stdin handles for sending messages to running CLI processes.
#[derive(Debug, Default, Clone)]
pub struct StdinManager {
    handles: Arc<Mutex<HashMap<String, ChildStdin>>>,
}

impl StdinManager {
    pub fn new() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, id: String, stdin: ChildStdin) {
        let mut map = self.handles.lock().await;
        map.insert(id, stdin);
    }

    /// Write a message to the stdin pipe, followed by a newline (atomic write).
    pub async fn send(&self, id: &str, message: &str) -> Result<(), String> {
        let mut map = self.handles.lock().await;
        let stdin = map
            .get_mut(id)
            .ok_or_else(|| format!("No stdin handle for session: {}", id))?;

        let payload = format!("{}\n", message);
        stdin
            .write_all(payload.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }

    pub async fn remove(&self, id: &str) {
        let mut map = self.handles.lock().await;
        map.remove(id);
    }
}
