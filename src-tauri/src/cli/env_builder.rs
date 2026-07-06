use std::collections::HashMap;
use std::path::PathBuf;

/// Build the environment variables for a Claude CLI child process on Windows.
///
/// On Windows, Claude Code requires git-bash in PATH. This function:
/// 1. Detects git-bash location (PortableGit, Git for Windows, Scoop)
/// 2. Adds it to PATH
/// 3. Sets CLAUDE_CODE_GIT_BASH_PATH if needed
/// 4. Merges any provider-specific env vars
pub fn build_cli_env(
    extra_env: &HashMap<String, String>,
) -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();

    // Ensure git-bash is in PATH on Windows
    if cfg!(target_os = "windows") {
        if let Some(git_bash_path) = find_git_bash() {
            let current_path = env.get("PATH").cloned().unwrap_or_default();
            let new_path = format!("{};{}", git_bash_path.display(), current_path);
            env.insert("PATH".to_string(), new_path);

            // Tell Claude Code where git-bash is
            env.insert(
                "CLAUDE_CODE_GIT_BASH_PATH".to_string(),
                git_bash_path
                    .parent()
                    .map(|p| p.display().to_string())
                    .unwrap_or_else(|| git_bash_path.display().to_string()),
            );
        }
    }

    // Inject extra env vars (API keys, base URLs, etc.)
    for (key, value) in extra_env {
        env.insert(key.clone(), value.clone());
    }

    // Disable interactive prompts
    env.insert("CI".to_string(), "true".to_string());

    env
}

/// Find git-bash on Windows. Checks common locations.
pub fn find_git_bash() -> Option<PathBuf> {
    if !cfg!(target_os = "windows") {
        return None;
    }

    let candidates = [
        // Git for Windows (default install)
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        // PortableGit (TOKENICODE pattern)
        r"C:\Git\bin\bash.exe",
        r"C:\PortableGit\bin\bash.exe",
        // Scoop
        r"C:\Users\Public\scoop\apps\git\current\bin\bash.exe",
    ];

    // Also check user-local scoop
    if let Ok(home) = std::env::var("USERPROFILE") {
        let scoop_path = PathBuf::from(&home)
            .join("scoop")
            .join("apps")
            .join("git")
            .join("current")
            .join("bin")
            .join("bash.exe");
        if scoop_path.exists() {
            return Some(scoop_path);
        }
    }

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }

    // Try to find via `where` command
    if let Ok(output) = std::process::Command::new("where").arg("bash").output() {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                for line in stdout.lines() {
                    let path = PathBuf::from(line.trim());
                    if path.exists() {
                        return Some(path);
                    }
                }
            }
        }
    }

    None
}

/// Check if git-bash is available.
pub fn has_git_bash() -> bool {
    find_git_bash().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_cli_env_includes_required_vars() {
        let env = build_cli_env(&HashMap::new());
        assert!(env.contains_key("PATH"));
        assert_eq!(env.get("CI").map(|v| v.as_str()), Some("true"));
    }

    #[test]
    fn build_cli_env_merges_extra_vars() {
        let mut extra = HashMap::new();
        extra.insert("ANTHROPIC_API_KEY".to_string(), "test-key".to_string());
        let env = build_cli_env(&extra);
        assert_eq!(env.get("ANTHROPIC_API_KEY").map(|v| v.as_str()), Some("test-key"));
    }
}
