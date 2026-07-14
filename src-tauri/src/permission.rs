use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PermissionRequest {
    session_id: String,
    tool_name: String,
    input: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PermissionEvent {
    request_id: String,
    tool_name: String,
    input: serde_json::Value,
}

#[derive(Debug)]
struct Decision {
    allow: bool,
    message: Option<String>,
}

#[derive(Clone, Default)]
pub struct PermissionManager {
    port: Arc<Mutex<Option<u16>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Decision>>>>,
}

impl PermissionManager {
    pub async fn start(&self, app: AppHandle) -> Result<(), String> {
        let listener = TcpListener::bind("127.0.0.1:0").await
            .map_err(|e| format!("Failed to start permission bridge: {}", e))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        *self.port.lock().await = Some(port);
        let manager = self.clone();
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else { break };
                let manager = manager.clone();
                let app = app.clone();
                tokio::spawn(async move { manager.handle_request(stream, app).await; });
            }
        });
        Ok(())
    }

    pub async fn respond(&self, request_id: &str, allow: bool, message: Option<String>) -> Result<(), String> {
        let sender = self.pending.lock().await.remove(request_id)
            .ok_or_else(|| "Permission request has expired".to_string())?;
        sender.send(Decision { allow, message })
            .map_err(|_| "Permission request is no longer active".to_string())
    }

    pub async fn create_mcp_config(&self, session_id: &str) -> Result<PathBuf, String> {
        let port = self.port.lock().await.ok_or_else(|| "Permission bridge is not ready".to_string())?;
        let script = std::env::temp_dir().join("justneedthink-permission-mcp.js");
        std::fs::write(&script, include_str!("../resources/permission-mcp.js"))
            .map_err(|e| format!("Failed to prepare permission bridge: {}", e))?;
        let config = std::env::temp_dir().join(format!("justneedthink-mcp-{}.json", session_id));
        let value = serde_json::json!({
            "mcpServers": {
                "justneedthink-permission": {
                    "command": "node",
                    "args": [script],
                    "env": { "JNT_PERMISSION_PORT": port.to_string(), "JNT_SESSION_ID": session_id }
                }
            }
        });
        std::fs::write(&config, serde_json::to_vec(&value).unwrap())
            .map_err(|e| format!("Failed to create permission config: {}", e))?;
        Ok(config)
    }

    async fn handle_request(&self, mut stream: TcpStream, app: AppHandle) {
        let mut bytes = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            let Ok(read) = stream.read(&mut buffer).await else { return };
            if read == 0 { return; }
            bytes.extend_from_slice(&buffer[..read]);
            let Some(header_end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") else { continue };
            let header = String::from_utf8_lossy(&bytes[..header_end]);
            let length = header.lines().find_map(|line| line.strip_prefix("Content-Length:")
                .or_else(|| line.strip_prefix("content-length:")))
                .and_then(|value| value.trim().parse::<usize>().ok()).unwrap_or(0);
            if bytes.len() >= header_end + 4 + length { break; }
        }
        let Some(body_start) = bytes.windows(4).position(|w| w == b"\r\n\r\n").map(|n| n + 4) else { return };
        let Ok(request) = serde_json::from_slice::<PermissionRequest>(&bytes[body_start..]) else { return };
        let request_id = uuid::Uuid::new_v4().to_string();
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(request_id.clone(), sender);
        let event = PermissionEvent { request_id: request_id.clone(), tool_name: request.tool_name, input: request.input };
        let _ = app.emit(&format!("claude:permission:{}", request.session_id), event.clone());
        let decision = tokio::time::timeout(tokio::time::Duration::from_secs(300), receiver).await;
        self.pending.lock().await.remove(&request_id);
        let body = match decision {
            Ok(Ok(decision)) if decision.allow => serde_json::json!({ "behavior": "allow", "updatedInput": event.input }),
            Ok(Ok(decision)) => serde_json::json!({ "behavior": "deny", "message": decision.message.unwrap_or_else(|| "Denied by user".into()) }),
            _ => serde_json::json!({ "behavior": "deny", "message": "Permission request timed out" }),
        };
        let content = serde_json::to_string(&body).unwrap();
        let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", content.len(), content);
        let _ = stream.write_all(response.as_bytes()).await;
    }
}
