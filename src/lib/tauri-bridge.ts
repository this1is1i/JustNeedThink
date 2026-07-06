import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// --- Types ---

export interface StartSessionParams {
  prompt: string;
  cwd: string;
  model?: string;
  session_id: string;
  thinking_level?: string;
  permission_mode?: string;
  context_window?: number;
}

export interface SessionInfo {
  session_id: string;
  pid: number;
  cli_path: string;
}

export interface CliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
  git_bash_available: boolean;
}

// --- IPC Bridge ---

export const bridge = {
  // Session management
  checkClaudeCli: (): Promise<CliStatus> =>
    invoke<CliStatus>('check_claude_cli'),

  startSession: (params: StartSessionParams): Promise<SessionInfo> =>
    invoke<SessionInfo>('start_claude_session', { params }),

  sendStdin: (stdinId: string, message: string): Promise<void> =>
    invoke<void>('send_stdin', { stdinId, message }),

  killSession: (stdinId: string): Promise<void> =>
    invoke<void>('kill_session', { stdinId }),

  listActiveProcesses: (): Promise<string[]> =>
    invoke<string[]>('list_active_processes'),
};

// --- Event Listeners ---

export function onClaudeStream(
  stdinId: string,
  callback: (message: Record<string, unknown>) => void,
): Promise<UnlistenFn> {
  return listen<Record<string, unknown>>(
    `claude:stream:${stdinId}`,
    (event) => callback(event.payload),
  );
}

export function onClaudeStderr(
  stdinId: string,
  callback: (line: string) => void,
): Promise<UnlistenFn> {
  return listen<string>(
    `claude:stderr:${stdinId}`,
    (event) => callback(event.payload),
  );
}

export function onSessionExit(
  stdinId: string,
  callback: (code: number | null) => void,
): Promise<UnlistenFn> {
  return listen<{ code: number | null }>(
    `claude:exit:${stdinId}`,
    (event) => callback(event.payload.code),
  );
}
