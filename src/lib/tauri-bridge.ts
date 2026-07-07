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

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  createdAt: number;
  sessionCount: number;
  isArchived: boolean;
  gitBranch: string | null;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[] | null;
}

export interface FileChangeEvent {
  kind: 'created' | 'modified' | 'removed';
  paths: string[];
  root: string;
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

  // Filesystem
  readFileTree: (path: string, depth?: number): Promise<FileNode[]> =>
    invoke<FileNode[]>('read_file_tree', { path, depth }),

  readFileContent: (path: string): Promise<string> =>
    invoke<string>('read_file_content', { path }),

  writeFileContent: (path: string, content: string): Promise<void> =>
    invoke<void>('write_file_content', { path, content }),

  copyFile: (src: string, dest: string): Promise<void> =>
    invoke<void>('copy_file', { src, dest }),

  renameFile: (src: string, dest: string): Promise<void> =>
    invoke<void>('rename_file', { src, dest }),

  deleteFile: (path: string): Promise<void> =>
    invoke<void>('delete_file', { path }),

  createDirectory: (path: string): Promise<void> =>
    invoke<void>('create_directory', { path }),

  getFileSize: (path: string): Promise<number> =>
    invoke<number>('get_file_size', { path }),

  watchDirectory: (path: string): Promise<void> =>
    invoke<void>('watch_directory', { path }),

  unwatchDirectory: (path: string): Promise<void> =>
    invoke<void>('unwatch_directory', { path }),

  // Projects
  listProjects: (): Promise<ProjectInfo[]> =>
    invoke<ProjectInfo[]>('list_projects'),

  createProject: (name: string, path: string): Promise<ProjectInfo> =>
    invoke<ProjectInfo>('create_project', { name, path }),

  removeProject: (id: string): Promise<void> =>
    invoke<void>('remove_project', { id }),

  touchProject: (id: string): Promise<void> =>
    invoke<void>('touch_project', { id }),

  listProjectSessions: (projectId: string): Promise<unknown[]> =>
    invoke<unknown[]>('list_project_sessions', { projectId }),

  // Credit
  getCreditSummary: (): Promise<import('../stores/creditStore').CreditSummary> =>
    invoke<import('../stores/creditStore').CreditSummary>('get_credit_summary'),

  getCreditHistory: (): Promise<unknown[]> =>
    invoke<unknown[]>('get_credit_history'),

  // Commands
  listBuiltinCommands: (): Promise<import('../stores/commandStore').PaletteCommand[]> =>
    invoke<import('../stores/commandStore').PaletteCommand[]>('list_builtin_commands'),
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

export function onFileChange(
  callback: (event: FileChangeEvent) => void,
): Promise<UnlistenFn> {
  return listen<FileChangeEvent>('fs:change', (event) => callback(event.payload));
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
