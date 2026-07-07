use serde::{Deserialize, Serialize};

/// Project information returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened_at: i64,
    pub created_at: i64,
    pub session_count: usize,
    pub is_archived: bool,
    pub git_branch: Option<String>,
}

/// Create a new project entry.
pub fn create_project(id: &str, name: &str, path: &str) -> ProjectInfo {
    let now = now_ms();
    ProjectInfo {
        id: id.to_string(),
        name: name.to_string(),
        path: path.to_string(),
        last_opened_at: now,
        created_at: now,
        session_count: 0,
        is_archived: false,
        git_branch: None,
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
