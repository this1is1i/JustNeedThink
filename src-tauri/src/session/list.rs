use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A session summary from disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSession {
    pub id: String,
    pub path: String,
    pub project: String,
    pub modified_at: u64,
    pub preview: String,
}

/// Encode a project path the same way Claude CLI does.
/// D:\AAWorkSpeace\liteplay → -D--AAWorkSpeace-liteplay
fn encode_project_path(path: &str) -> String {
    let cleaned = path
        .replace(':', "")
        .replace('\\', "-")
        .replace('/', "-");
    format!("-{}", cleaned.trim_start_matches('-'))
}

/// Scan the Claude CLI sessions directory for a project.
pub fn list_project_sessions(project_path: &str) -> Vec<DiskSession> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };

    let encoded = encode_project_path(project_path);
    let sessions_dir = home
        .join(".claude")
        .join("projects")
        .join(&encoded)
        .join("sessions");

    if !sessions_dir.exists() {
        return Vec::new();
    }

    let mut sessions = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() || path.extension().map_or(true, |e| e != "jsonl") {
                continue;
            }

            let modified_at = path.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            let id = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Extract first user message as preview
            let preview = extract_preview(&path).unwrap_or_default();

            sessions.push(DiskSession {
                id,
                path: path.display().to_string(),
                project: project_path.to_string(),
                modified_at,
                preview: preview.chars().take(100).collect(),
            });
        }
    }

    sessions.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    sessions
}

/// Extract the first user message from a JSONL session file for preview.
fn extract_preview(path: &PathBuf) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    for line in content.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            if val.get("type").and_then(|v| v.as_str()) == Some("user") {
                if let Some(msg) = val.get("message") {
                    if let Some(content) = msg.get("content") {
                        if let Some(text) = content.as_str() {
                            return Some(text.to_string());
                        }
                        if let Some(arr) = content.as_array() {
                            for block in arr {
                                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                                    return Some(text.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Load full session content from a JSONL file.
pub fn load_session_content(path: &str) -> Result<Vec<serde_json::Value>, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read session: {}", e))?;
    let mut messages = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() { continue; }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            messages.push(val);
        }
    }
    Ok(messages)
}
