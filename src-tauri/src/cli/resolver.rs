use std::path::PathBuf;

/// Result of scanning for a Claude CLI binary.
#[derive(Debug, Clone)]
pub struct CliBinary {
    pub path: PathBuf,
    pub version: Option<String>,
    pub source: CliSource,
}

#[derive(Debug, Clone)]
pub enum CliSource {
    /// npm global install: `claude` or `claude.cmd` on PATH
    NpmGlobal,
    /// Directly downloaded binary (e.g. bundled with the app)
    AppLocal,
    /// Found via `which`/`where` on system PATH
    SystemPath,
}

/// Find the Claude CLI binary. Searches in priority order:
/// 1. npm global prefix bin directory
/// 2. App-local download directory
/// 3. System PATH
pub fn find_claude_binary() -> Option<CliBinary> {
    // Priority 1: npm global bin directory
    if let Some(bin) = find_npm_global_claude() {
        return Some(bin);
    }

    // Priority 2: App-local download
    if let Some(bin) = find_app_local_claude() {
        return Some(bin);
    }

    // Priority 3: System PATH
    find_system_claude()
}

fn find_npm_global_claude() -> Option<CliBinary> {
    let npm_prefix = std::process::Command::new("npm")
        .args(["prefix", "-g"])
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                String::from_utf8(out.stdout).ok()
            } else {
                None
            }
        })
        .map(|s| s.trim().to_string());

    let bin_name = npm_claude_binary_name();
    if let Some(prefix) = npm_prefix {
        let candidate = PathBuf::from(&prefix).join("bin").join(bin_name);
        if candidate.exists() {
            return Some(CliBinary { version: get_version(&candidate), path: candidate, source: CliSource::NpmGlobal });
        }
    }

    // Also try %APPDATA%/npm on Windows
    if let Ok(appdata) = std::env::var("APPDATA") {
        let candidate = PathBuf::from(&appdata).join("npm").join(bin_name);
        if candidate.exists() {
            return Some(CliBinary { version: get_version(&candidate), path: candidate, source: CliSource::NpmGlobal });
        }
    }

    None
}

fn find_app_local_claude() -> Option<CliBinary> {
    let app_dir = dirs::data_local_dir()?.join("JustNeedThink").join("cli");
    let candidate = app_dir.join(npm_claude_binary_name());
    if candidate.exists() {
        return Some(CliBinary {
            version: get_version(&candidate),
            path: candidate,
            source: CliSource::AppLocal,
        });
    }
    None
}

fn find_system_claude() -> Option<CliBinary> {
    let name = sys_claude_binary_name();
    // Use `where` on Windows, `which` on Unix
    let cmd = if cfg!(target_os = "windows") {
        std::process::Command::new("where")
            .arg(&name)
            .output()
    } else {
        std::process::Command::new("which")
            .arg(&name)
            .output()
    };

    let output = cmd.ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let first_line = stdout.lines().next()?.trim();

    if first_line.is_empty() {
        return None;
    }

    let path = PathBuf::from(first_line);
    if path.exists() {
        return Some(CliBinary {
            version: get_version(&path),
            path,
            source: CliSource::SystemPath,
        });
    }

    None
}

fn get_version(path: &PathBuf) -> Option<String> {
    std::process::Command::new(path)
        .arg("--version")
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                String::from_utf8(out.stdout)
                    .ok()
                    .map(|s| s.trim().to_string())
            } else {
                None
            }
        })
}

/// Check if a claude binary path needs cmd.exe wrapping on Windows.
pub fn needs_cmd_wrapper(path: &str) -> bool {
    cfg!(target_os = "windows")
        && (path.ends_with(".cmd")
            || path.ends_with(".bat")
            || (!path.contains('\\') && !path.contains('/') && !path.contains('.')))
}

/// Get the OS-appropriate claude binary name.
/// Name used by npm global installs on Windows (shim files).
fn npm_claude_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "claude.cmd" } else { "claude" }
}

/// Name used by system PATH search on Windows.
/// `where claude` matches claude.exe, claude.cmd, claude.bat.
fn sys_claude_binary_name() -> &'static str {
    "claude"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn needs_cmd_wrapper_returns_true_for_cmd() {
        assert!(needs_cmd_wrapper("claude.cmd"));
        assert!(needs_cmd_wrapper("claude.bat"));
        assert!(needs_cmd_wrapper("claude"));
    }

    #[test]
    fn find_claude_returns_none_when_no_installation() {
        // When no Claude CLI is installed, we should get None gracefully.
        // We can't guarantee Claude is installed in CI, but the function
        // must not panic.
        let _ = find_claude_binary();
    }
}
