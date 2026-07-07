use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessage {
    pub from: String,
    pub to: String,
    pub task_id: String,
    pub content: String,
    pub msg_type: MessageType,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    DelegateTask,
    TaskResult,
    RequestInfo,
    InfoResponse,
}

#[derive(Default)]
pub struct AgentMessageBus {
    subscribers: Arc<Mutex<HashMap<String, Vec<mpsc::Sender<AgentMessage>>>>>,
}

impl AgentMessageBus {
    pub fn new() -> Self {
        Self { subscribers: Arc::new(Mutex::new(HashMap::new())) }
    }

    pub async fn publish(&self, to: &str, msg: AgentMessage) -> Result<(), String> {
        let map = self.subscribers.lock().await;
        if let Some(senders) = map.get(to) {
            for tx in senders {
                tx.send(msg.clone()).await.map_err(|e| format!("Send failed: {}", e))?;
            }
        }
        Ok(())
    }

    pub async fn subscribe(&self, agent_id: &str) -> mpsc::Receiver<AgentMessage> {
        let (tx, rx) = mpsc::channel(64);
        let mut map = self.subscribers.lock().await;
        map.entry(agent_id.to_string()).or_default().push(tx);
        rx
    }
}
