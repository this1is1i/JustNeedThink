# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JustNeedThink is a native **Windows** desktop GUI for the official Claude Code CLI, built with **Tauri 2 (Rust) + React 19 + TypeScript + Tailwind CSS 4 + Zustand 5**. The core design principle: **spawn the official `claude` binary as a subprocess and communicate over its NDJSON `stream-json` protocol — never call the Anthropic API directly.** This keeps every CLI capability (sub-agents, MCP, hooks, skills, CLAUDE.md) 100% compatible.

## Development Commands

```bash
pnpm install           # Install frontend deps (pnpm is the package manager)
pnpm dev               # Vite dev server only (port 5173, no Rust backend)
pnpm build             # Frontend build: tsc -b && vite build
pnpm lint              # oxlint (config in .oxlintrc.json) — NOT eslint
pnpm tauri dev         # Full app: Vite + Rust backend (use this to run the real app)
pnpm tauri build       # Production build → NSIS installer + portable .exe

# Rust backend (run from src-tauri/)
cd src-tauri && cargo check          # Fast compile check
cd src-tauri && cargo clippy         # Lints
cd src-tauri && cargo test           # All Rust tests
cd src-tauri && cargo test <name>    # Single test by name substring
```

There is no frontend test runner configured yet. `pnpm build` (via `tsc -b`) is the type-check gate for TS/TSX.

## Architecture

### The IPC + streaming spine (read this first)

```
React component → Zustand store → src/lib/tauri-bridge.ts → invoke("cmd", args)
                                                                   │
                                        src-tauri/src/lib.rs  #[tauri::command] fns
                                                                   │
                              spawns  claude --input-format stream-json
                                              --output-format stream-json --verbose
                                              --include-partial-messages --print
                                                                   │
       stdout NDJSON ──▶ per-line parse ──▶ app.emit("claude:stream:<session_id>", json)
       stderr        ──▶ app.emit("claude:stderr:<session_id>", line)
       process exit  ──▶ app.emit("claude:exit:<session_id>", {code})
```

**Key invariant: `session_id` == `stdin_id` == the Tauri event channel suffix.** A session's stdout/stderr/exit events are all namespaced by its id (`claude:stream:<id>`). The frontend subscribes per-session in `useStreamProcessor.ts`; `tauri-bridge.ts` exposes `onClaudeStream/onClaudeStderr/onSessionExit(stdinId, cb)` helpers. When touching session routing, keep this three-way identity intact — it's the single most load-bearing convention in the app.

- **Sending input:** `send_stdin` / the initial prompt wrap text as `{"type":"user","message":{"role":"user","content":...}}` and write it to the child's stdin via `StdinManager`.
- **Process lifecycle:** `cli/process_manager.rs` tracks `ManagedProcess` by id; `session/lifecycle.rs` spawns readers via `tokio::spawn`. The stdout reader has a 30-min inactivity timeout and **must** remove the process from both `ProcessManager` and `StdinManager` on exit (leak avoidance — see `known-issues.md` C2/C3).
- **CLI resolution:** `cli/resolver.rs` finds the `claude` binary; on Windows a `.cmd`/`.ps1` shim is invoked through `cmd /C`, and the child is spawned with `CREATE_NO_WINDOW | DETACHED_PROCESS` (creation flag `0x08000000 | 0x00000008`) to suppress console popups from git/npm/etc.

### Backend command registration

All `#[tauri::command]` functions are thin wrappers registered in the single `invoke_handler![...]` block in `src-tauri/src/lib.rs`. To add a backend capability: implement it in the relevant domain module, add a wrapper in `lib.rs`, register it in the handler list, then add a typed method to `bridge` in `src/lib/tauri-bridge.ts`. Domain modules under `src-tauri/src/`:

| Module | Responsibility |
|--------|----------------|
| `cli/` | Binary resolution, process spawn/kill/track, stdin routing, env building |
| `session/` | `lifecycle.rs` (spawn/send/kill commands), `list.rs` (scan `~/.claude` disk sessions, load JSONL history) |
| `stream/` | NDJSON line parser, SDK control-protocol types, stream→event bridge |
| `filesystem/` | File tree, CRUD ops, `notify`-based watcher (emits `fs:change`) |
| `db/` | SQLite via `rusqlite` (bundled); `schema.rs` DDL+migrations, `project_repo`, `session_repo` |
| `project/` | Multi-project registry, workspace init, git branch detection |
| `agent/` | Built-in agent defs, teams, in-memory monitor + message bus |
| `workflow/` | Workflow definitions + default templates (execution engine is largely stubbed) |
| `skill/` | Skill file loader/reader/writer |
| `credit/` | In-memory usage tracker + summary (no persistence yet) |
| `commands/` | Built-in slash-command catalog for the palette |
| `utils/` | ANSI stripping, platform helpers |

### Graceful DB degradation

`AppState.db` is `Option<Arc<TokioMutex<Connection>>>`. If SQLite fails to open, the app runs **without persistence** rather than crashing. All DB-backed commands go through `AppState::with_db(|conn| ...)`, which returns a friendly error string when the DB is absent. Preserve this pattern — do not `unwrap()` the connection.

### Frontend state

Zustand stores in `src/stores/` are the source of truth (`chatStore` holds per-tab message/streaming state keyed by `tabId`; also `project`, `file`, `credit`, `agent`, `workflow`, `skill`, `command`). `App.tsx` holds the single `AppShell` with a 3-pane layout (projects/sessions sidebar · chat · right panel with Files/Agents/Workflows/Skills tabs) wrapped in a class-based `AppErrorBoundary`. Styling uses Tailwind 4 utility classes plus CSS custom properties (`var(--color-*)` defined in `src/styles.css`) for theming — new components should follow the `var(--color-*)` convention rather than hardcoding colors.

## Conventions

- **Errors cross the IPC boundary as `Result<T, String>`** — user-facing, friendly strings (no internal paths/stack traces). Detailed context is logged server-side via `log::`.
- **Path safety:** backend commands that spawn processes or write/delete files reject system directories (e.g. `C:\Windows`). Keep new filesystem/spawn commands guarded.
- Commit messages are **bilingual (Chinese first, English second)** per repo history; types: `feat/fix/refactor/docs/test/chore/perf/ci`.

## Status & Known Issues

`docs/known-issues.md` is an active review log (severity-ranked, with a fix-status table — 10/23 resolved as of last review). Check it before starting work: it flags remaining gaps such as credit persistence (H2), CSP being `null` (H5), workflow execution being unimplemented (M5), agent monitor not wired to the stream (M6), and no Toast/i18n system yet. `docs/01-architecture.md` has the full phase plan; `docs/pending-features.md` and `docs/bug-fix-log.md` track the rest.
