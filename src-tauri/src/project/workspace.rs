use std::path::PathBuf;

/// Get the workspace config directory for a project.
pub fn workspace_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".justneedthink")
}

/// Ensure the workspace directory exists.
pub fn ensure_workspace(project_path: &str) -> Result<(), String> {
    let dir = workspace_dir(project_path);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create workspace dir: {}", e))
}
