# JustNeedThink — 项目记忆

> 最后更新: 2026-07-07 (Phase 1 完成后)
> 每次改动前请先阅读本文及 docs/ 下所有文件了解项目现状。

## 项目身份

- **名称**: JustNeedThink
- **仓库**: https://github.com/this1is1i/JustNeedThink.git
- **路径**: `D:\AAWorkSpeace\liteplay\JustNeedThink\`
- **定位**: Windows 桌面 Claude Code CLI GUI 外壳

## 核心原则

**spawn 官方 CLI 子进程，不直接调 API。** 通过 `--input-format stream-json --output-format stream-json` 与 Claude CLI 通信，保持 sub-agents、MCP、hooks、skills、claude.md 全部 100% 兼容。

## 技术栈（已落地）

| 层 | 实际版本 | 备注 |
|----|---------|------|
| 桌面 | Tauri 2.11 | Rust 后端 + 系统 WebView |
| 前端 | React 19 + TypeScript 5.8 + Vite 8 + Tailwind CSS 4 | Vite 8 需要单独安装 esbuild |
| 状态 | Zustand 5 | per-tab Map 模式 |
| DB | SQLite (rusqlite 0.31, bundled) | 零外部依赖 |
| 安装 | NSIS (currentUser) | 不侵入注册表 |
| 测试 | Rust: #[test], 前端: (待加) | |

## 当前进度

- [x] **Phase 0** — 脚手架 (ab9d4ff)
- [x] **Phase 1** — CLI 集成 + 聊天 (26335f7)
- [x] **Phase 2** — 文件系统 + SQLite (c341c72)
- [x] **Phase 3** — 多项目系统 (75d962f)
- [x] **Phase 4** — Credit 追踪 (4a82729)
- [x] **Phase 5** — 命令面板 (79425cb)
- [x] **Phase 6** — Agent 协作 (0843c5c)
- [x] **Phase 7** — Workflow (6a7c44c)
- [x] **Phase 8** — Skill + 打包 (0f85c2e) ← 全部完成

## 已实现模块

### Rust 后端 (34 个 .rs 文件, 27 个 Tauri 命令)

```
src-tauri/src/
├── main.rs               # windows_subsystem = "windows"
├── lib.rs                # Tauri builder + 5 个命令注册 + AppState
├── error.rs              # AppError (thiserror)
├── cli/
│   ├── mod.rs            # pub mod 声明
│   ├── process_manager.rs # HashMap<stdinId, ManagedProcess>
│   ├── stdin_manager.rs  # HashMap<stdinId, ChildStdin>
│   ├── resolver.rs       # find_claude_binary (3 级回退)
│   └── env_builder.rs    # build_cli_env (git-bash 5路径检测)
├── session/
│   ├── mod.rs
│   └── lifecycle.rs      # 5 个 Tauri commands + stdout/stderr async reader
├── stream/               # 解析器存根 (parser, protocol, session_bridge)
├── db/                   # 存根 (schema)
├── filesystem/           # 存根 (ops, tree, watcher)
└── utils/                # ansi (含测试), platform
```

### 前端 (11 个 .ts/.tsx 文件)

```
src/
├── App.tsx               # SetupWizard + SessionSidebar + ChatPanel
├── main.tsx              # React root
├── styles.css            # Catppuccin 主题 (dark/light)
├── lib/tauri-bridge.ts   # 5 个 invoke + 3 个事件监听
├── stores/chatStore.ts   # per-tab Map 模式消息状态
├── hooks/useStreamProcessor.ts # NDJSON 消息分发 + sendMessage
└── components/chat/
    ├── ChatPanel.tsx     # 消息列表 + 流式渲染 + 活动指示器
    ├── InputBar.tsx      # Enter/Shift+Enter + 自适应高度
    └── MessageBubble.tsx # 用户/助手/工具/思考气泡
```

## 关键设计模式

1. **tauri-bridge 作为 IPC 唯一入口** — 所有 invoke + listen 调用集中在一个文件
2. **per-tab Map 模式** — chatStore 使用 `Map<tabId, TabData>` 支持并行会话
3. **不可变更新** — `new Map(oldMap); tabs.set(id, {...tab, field: newVal}); set({tabs})`
4. **AppState 统一管理** — ProcessManager + StdinManager + CliBinary 通过 Tauri State 注入
5. **流桥接** — Rust stdout reader → `app.emit("claude:stream:{stdinId}", json)` → 前端 `listen()`

## 踩过的坑

1. **Vite 8 不内置 esbuild** — 需要 `pnpm add -D esbuild`，否则 `transformWithEsbuild` 报错
2. **Tauri 2 bundle targets** — `"portable"` 不是有效值，只有 `"nsis"` 等，portable 是 windows 子配置
3. **serde_json::json! 不支持 `as` 关键字** — 用 `serde_json::Value::Null` 代替 `null as Option<i32>`
4. **Windows cmd wrapper** — `.cmd`/`.bat` 路径需要 `TokioCommand::new("cmd").arg("/C").arg(path)`
5. **CREATE_NO_WINDOW** — Windows spawn 子进程需 `creation_flags(0x08000000)` 隐藏控制台

## 验证检查清单

每次改动后必须通过：
- `cargo check` — Rust 编译
- `cargo test` — Rust 测试 (当前 6/6)
- `npx tsc -b` — TypeScript 类型检查
- `pnpm build` — Vite 前端构建

## 下一步: Phase 2 目标

1. `filesystem/tree.rs` + `filesystem/ops.rs` + `filesystem/watcher.rs` — 文件操作
2. `db/schema.rs` — 完整 SQLite schema + 迁移系统
3. `db/session_repo.rs` — 会话持久化 CRUD
4. 前端 `fileStore` + FileExplorer + FilePreview (CodeMirror 6)
5. 会话导出 Markdown/JSON
