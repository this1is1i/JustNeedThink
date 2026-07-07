use std::path::PathBuf;
use std::process::Command;

/// Get the current git branch for a directory.
pub fn get_current_branch(cwd: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(cwd)
        .output()
        .ok()?;

    if output.status.success() {
        String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

/// Check if a directory is a git repository.
pub fn is_git_repo(cwd: &str) -> bool {
    Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(cwd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Create a git worktree for isolated agent work.
pub fn create_worktree(repo_path: &str, branch_name: &str) -> Result<PathBuf, String> {
    let worktree_path = PathBuf::from(repo_path)
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .join(format!("{}_worktree", branch_name));

    let output = Command::new("git")
        .args(["worktree", "add", worktree_path.to_str().unwrap(), "-b", branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to create worktree: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Worktree creation failed: {}", stderr));
    }

    Ok(worktree_path)
}

/// Remove a git worktree.
pub fn remove_worktree(repo_path: &str, worktree_path: &str) -> Result<(), String> {
    Command::new("git")
        .args(["worktree", "remove", worktree_path, "--force"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to remove worktree: {}", e))?;
    Ok(())
}
