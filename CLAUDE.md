# JustNeedThink — CLAUDE.md

> Last updated: 2026-07-07
> Repository: https://github.com/this1is1i/JustNeedThink.git

## Project Overview

JustNeedThink is a native Windows desktop GUI for Claude Code CLI, built with **Tauri 2 + React 19 + TypeScript + Tailwind CSS 4 + Zustand 5**. It wraps the official Claude CLI binary in a rich GUI with multi-project management, parallel sessions, agent collaboration, workflow orchestration, skill management, credit tracking, a command palette with autocomplete, and comprehensive keyboard shortcuts.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Desktop | Tauri 2 (Rust backend + system WebView) |
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand 5 |
| Code Editor | CodeMirror 6 |
| Build | Vite + pnpm |
| Backend | Rust (tokio, serde, rusqlite, reqwest, notify) |
| CLI | Official `claude` binary (NDJSON stream-json + SDK Control Protocol) |
| DB | SQLite (rusqlite, bundled) |

## Development Commands

```bash
pnpm install           # Install frontend deps
pnpm dev               # Vite dev server only (port 5173)
pnpm build             # Frontend build only
pnpm tauri dev         # Full Tauri dev mode (frontend + Rust)
pnpm tauri build       # Production build (NSIS + portable exe)

# Rust only
cd src-tauri && cargo check && cargo clippy && cargo test
```

## Architecture

```
React UI → src/lib/tauri-bridge.ts → Tauri invoke() → src-tauri/src/lib.rs
                                                                │
                                                         Claude CLI (subprocess)
                                                         --output-format stream-json
```

## Rust Backend Modules

```
src-tauri/src/
├── main.rs              # Windows entry point
├── lib.rs               # Tauri builder + command registration
├── error.rs             # Unified error types (thiserror)
├── cli/                 # CLI lifecycle (process_manager, stdin_manager)
├── stream/              # NDJSON parsing (parser, protocol, session_bridge)
├── session/             # Session management (stub)
├── db/                  # SQLite persistence (schema)
├── filesystem/          # File operations (ops, tree, watcher)
└── utils/               # ANSI stripping, platform helpers
```

## Frontend Structure

```
src/
├── App.tsx              # Entry with ErrorBoundary + AppShell
├── styles.css           # Tailwind + CSS custom properties (themes)
├── stores/              # Zustand stores (stubs)
├── hooks/               # Custom hooks (stubs)
├── lib/                 # tauri-bridge, i18n, platform
└── components/          # UI components
    ├── layout/          # AppShell, Sidebar
    ├── chat/            # ChatPanel, InputBar, MessageBubble
    └── shared/          # MarkdownRenderer, Toast, etc.
```

## Development Phases

See `docs/01-architecture.md` for the full implementation plan.
