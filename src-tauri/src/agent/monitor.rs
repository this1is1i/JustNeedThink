use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub id: String,
    pub name: String,
    pub phase: AgentPhase,
    pub tool: Option<String>,
    pub parent_id: Option<String>,
    pub started_at: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentPhase {
    Spawning,
    Thinking,
    Writing,
    Tool,
    Completed,
    Error,
}

#[derive(Debug, Default)]
pub struct AgentMonitor {
    agents: Arc<Mutex<HashMap<String, AgentStatus>>>,
}

impl AgentMonitor {
    pub fn new() -> Self {
        Self { agents: Arc::new(Mutex::new(HashMap::new())) }
    }

    pub async fn upsert(&self, agent: AgentStatus) {
        let mut map = self.agents.lock().await;
        map.insert(agent.id.clone(), agent);
    }

    pub async fn update_phase(&self, id: &str, phase: AgentPhase, tool: Option<String>) {
        let mut map = self.agents.lock().await;
        if let Some(a) = map.get_mut(id) {
            a.phase = phase;
            a.tool = tool;
        }
    }

    pub async fn list_all(&self) -> Vec<AgentStatus> {
        let map = self.agents.lock().await;
        map.values().cloned().collect()
    }

    pub async fn clear(&self) {
        self.agents.lock().await.clear();
    }
}
