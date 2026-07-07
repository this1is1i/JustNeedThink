use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;

/// Holds a running CLI child process.
#[derive(Debug)]
pub struct ManagedProcess {
    pub child: Child,
    pub session_id: String,
}

/// Manages all active CLI child processes, keyed by stdin_id.
#[derive(Debug, Default)]
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, Arc<Mutex<ManagedProcess>>>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, id: String, process: ManagedProcess) {
        let mut map = self.processes.lock().await;
        map.insert(id, Arc::new(Mutex::new(process)));
    }

    pub async fn remove(&self, id: &str) -> Option<Arc<Mutex<ManagedProcess>>> {
        let mut map = self.processes.lock().await;
        map.remove(id)
    }

    pub async fn get(&self, id: &str) -> Option<Arc<Mutex<ManagedProcess>>> {
        let map = self.processes.lock().await;
        map.get(id).cloned()
    }

    pub async fn list_ids(&self) -> Vec<String> {
        let map = self.processes.lock().await;
        map.keys().cloned().collect()
    }

    /// Clone a shareable reference to this manager for use in spawned tasks.
    pub fn clone_arc(&self) -> Self {
        Self { processes: self.processes.clone() }
    }
}
