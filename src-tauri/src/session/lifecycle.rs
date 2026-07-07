use crate::cli::env_builder::build_cli_env;
use crate::cli::process_manager::ManagedProcess;
use crate::cli::resolver::{find_claude_binary, needs_cmd_wrapper, CliBinary};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;

// --- Types ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartSessionParams {
    pub prompt: String,
    pub cwd: String,
    pub model: Option<String>,
    pub session_id: String,
    pub thinking_level: Option<String>,
    pub permission_mode: Option<String>,
    pub context_window: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionInfo {
    pub session_id: String,
    pub pid: u32,
    pub cli_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CliStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub git_bash_available: bool,
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn check_claude_cli(state: State<'_, AppState>) -> Result<CliStatus, String> {
    let binary = find_claude_binary();
    let git_bash = crate::cli::env_builder::has_git_bash();

    if let Some(ref bin) = binary {
        let mut cli = state.cli_binary.lock().await;
        *cli = Some(bin.clone());
    }

    Ok(CliStatus {
        installed: binary.is_some(),
        path: binary.as_ref().map(|b| b.path.display().to_string()),
        version: binary.as_ref().and_then(|b| b.version.clone()),
        git_bash_available: git_bash,
    })
}

#[tauri::command]
pub async fn start_claude_session(
    app: AppHandle,
    state: State<'_, AppState>,
    params: StartSessionParams,
) -> Result<SessionInfo, String> {
    // Validate cwd
    let cwd_path = std::path::Path::new(&params.cwd);
    if !cwd_path.exists() {
        return Err(format!("Directory does not exist: {}", params.cwd));
    }
    if !cwd_path.is_dir() {
        return Err(format!("Not a directory: {}", params.cwd));
    }
    // Reject system directories
    let normalized = cwd_path.canonicalize().unwrap_or_else(|_| cwd_path.to_path_buf());
    let normalized_str = normalized.display().to_string();
    if normalized_str.starts_with(r"C:\Windows") || normalized_str.starts_with(r"C:\windows") {
        return Err("Cannot use system directories as working directory".to_string());
    }

    let cli = state
        .cli_binary
        .lock()
        .await
        .clone()
        .or_else(find_claude_binary)
        .ok_or_else(|| "Claude CLI not found. Please install it first.".to_string())?;

    let env = build_cli_env(&HashMap::new());
    let mut cmd = build_claude_command(&cli, &params, &env)?;

    let mut child = cmd
        .stdout(Stdio::piped())
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

    let pid = child.id().expect("process should have a PID");

    // Take ownership of stdin and stdout
    let child_stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let child_stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let child_stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    let stdin_id = params.session_id.clone();

    // Register stdin handle
    state.stdin_manager.insert(stdin_id.clone(), child_stdin).await;

    // Register process
    state.process_manager.insert(
        stdin_id.clone(),
        ManagedProcess {
            child,
            session_id: params.session_id.clone(),
        },
    ).await;

    // Spawn stdout reader task (with cleanup on exit)
    let app_clone = app.clone();
    let stdin_id_stdout = stdin_id.clone();
    let pm = state.process_manager.clone_arc();
    let sm = state.stdin_manager.clone();
    tokio::spawn(async move {
        read_stdout_stream(app_clone, child_stdout, &stdin_id_stdout).await;
        // Cleanup on process exit
        sm.remove(&stdin_id_stdout).await;
        pm.remove(&stdin_id_stdout).await;
    });

    // Spawn stderr reader task
    let app_clone2 = app.clone();
    let stdin_id_stderr = stdin_id.clone();
    tokio::spawn(async move {
        read_stderr_stream(app_clone2, child_stderr, &stdin_id_stderr).await;
    });

    // Send initial prompt
    let prompt_json = serde_json::json!({
        "type": "user",
        "message": {
            "role": "user",
            "content": params.prompt,
        }
    });
    state
        .stdin_manager
        .send(&stdin_id, &serde_json::to_string(&prompt_json).unwrap_or_default())
        .await?;

    Ok(SessionInfo {
        session_id: params.session_id,
        pid,
        cli_path: cli.path.display().to_string(),
    })
}

#[tauri::command]
pub async fn send_stdin(
    state: State<'_, AppState>,
    stdin_id: String,
    message: String,
) -> Result<(), String> {
    let payload = serde_json::json!({
        "type": "user",
        "message": {
            "role": "user",
            "content": message,
        }
    });
    state
        .stdin_manager
        .send(&stdin_id, &serde_json::to_string(&payload).unwrap_or_default())
        .await
}

#[tauri::command]
pub async fn kill_session(
    state: State<'_, AppState>,
    stdin_id: String,
) -> Result<(), String> {
    // Dropping the stdin handle sends EOF to the CLI, letting it finish the
    // current turn and write a complete, resumable session transcript.
    state.stdin_manager.remove(&stdin_id).await;

    if let Some(proc) = state.process_manager.remove(&stdin_id).await {
        let mut managed = proc.lock().await;
        // Give the CLI a moment to flush its session record and exit cleanly;
        // force-kill only if it doesn't terminate on its own.
        let graceful = tokio::time::timeout(
            tokio::time::Duration::from_secs(3),
            managed.child.wait(),
        ).await;
        if graceful.is_err() {
            managed
                .child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn list_active_processes(
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    Ok(state.process_manager.list_ids().await)
}

// --- Internal Helpers ---

/// Loose UUID check (8-4-4-4-12 hex) — enough to decide whether an id is safe
/// to pass to the CLI's `--session-id` flag.
fn is_uuid(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    parts.len() == 5
        && [8, 4, 4, 4, 12] == [parts[0].len(), parts[1].len(), parts[2].len(), parts[3].len(), parts[4].len()]
        && s.chars().all(|c| c == '-' || c.is_ascii_hexdigit())
}

fn build_claude_command(
    cli: &CliBinary,
    params: &StartSessionParams,
    env: &HashMap<String, String>,
) -> Result<TokioCommand, String> {
    let mut cmd = if needs_cmd_wrapper(&cli.path.display().to_string()) {
        let mut c = TokioCommand::new("cmd");
        c.arg("/C").arg(&cli.path);
        c
    } else {
        TokioCommand::new(&cli.path)
    };

    // Stream-json I/O mode
    cmd.arg("--input-format").arg("stream-json");
    cmd.arg("--output-format").arg("stream-json");
    cmd.arg("--verbose");
    cmd.arg("--include-partial-messages");
    cmd.arg("--print");

    // Working directory
    cmd.current_dir(&params.cwd);

    // Session id — use our own UUID so the on-disk transcript
    // (~/.claude/projects/<enc>/<session_id>.jsonl) is a first-class, resumable
    // session that Claude Code CLI recognises, and that we can correlate with
    // our UI session. Only pass it when it looks like a UUID (the CLI rejects
    // non-UUID ids); older non-UUID ids fall back to CLI-generated ones.
    if is_uuid(&params.session_id) {
        cmd.arg("--session-id").arg(&params.session_id);
    }

    // Model
    if let Some(ref model) = params.model {
        cmd.arg("--model").arg(model);
    }

    // Thinking level
    if let Some(ref level) = params.thinking_level {
        let effort = match level.as_str() {
            "off" => "off",
            "low" => "low",
            "medium" => "medium",
            "high" => "high",
            "max" => "max",
            _ => "medium",
        };
        cmd.env("CLAUDE_CODE_EFFORT_LEVEL", effort);
    }

    // Permission mode
    if let Some(ref mode) = params.permission_mode {
        if mode == "bypassPermissions" {
            cmd.arg("--dangerously-skip-permissions");
        } else {
            cmd.arg("--permission-mode").arg(mode);
            cmd.arg("--permission-prompt-tool").arg("stdio");
        }
    }

    // Inject environment
    for (key, value) in env {
        cmd.env(key, value);
    }

    // Windows: hide all console windows for this process and its children
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW | DETACHED_PROCESS: prevents cmd.exe and all
        // child processes (git, npm, etc.) from creating visible console windows
        cmd.creation_flags(0x08000000 | 0x00000008);
    }

    Ok(cmd)
}

async fn read_stdout_stream(
    app: AppHandle,
    stdout: tokio::process::ChildStdout,
    stdin_id: &str,
) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    // 30-minute inactivity timeout prevents hung readers
    let timeout = tokio::time::Duration::from_secs(1800);

    loop {
        let line_result = tokio::time::timeout(timeout, lines.next_line()).await;
        let line = match line_result {
            Ok(Ok(Some(l))) => l,
            Ok(Ok(None)) => break,        // EOF — normal exit
            Ok(Err(_)) => break,           // Read error
            Err(_elapsed) => {
                log::warn!("[stdout:{}] Reader timed out after 30min of inactivity", stdin_id);
                break;
            }
        };
        if line.trim().is_empty() {
            continue;
        }

        // Parse the NDJSON line
        match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(value) => {
                let event_name = format!("claude:stream:{}", stdin_id);
                let _ = app.emit(&event_name, value);
            }
            Err(_) => {
                // Forward raw line as error
                let event_name = format!("claude:stderr:{}", stdin_id);
                let _ = app.emit(&event_name, format!("Parse error: {}", line));
            }
        }
    }

    // Process exited — emit exit event
    let event_name = format!("claude:exit:{}", stdin_id);
    let _ = app.emit(&event_name, serde_json::json!({ "code": serde_json::Value::Null }));
}

async fn read_stderr_stream(
    app: AppHandle,
    stderr: tokio::process::ChildStderr,
    stdin_id: &str,
) {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();

    // Mirror the stdout reader's 30-minute inactivity timeout so a hung process
    // with no stderr output cannot leak this task forever.
    let timeout = tokio::time::Duration::from_secs(1800);

    loop {
        let line = match tokio::time::timeout(timeout, lines.next_line()).await {
            Ok(Ok(Some(l))) => l,
            Ok(Ok(None)) => break, // EOF
            Ok(Err(_)) => break,   // Read error
            Err(_elapsed) => {
                log::warn!("[stderr:{}] Reader timed out after 30min of inactivity", stdin_id);
                break;
            }
        };
        let event_name = format!("claude:stderr:{}", stdin_id);
        let _ = app.emit(&event_name, &line);
    }
}
