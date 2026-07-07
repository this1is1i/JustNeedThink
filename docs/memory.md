# JustNeedThink — 项目记忆

> 最后更新: 2026-07-07 (Bug 修复完成后)
> **每次改动前必须先读本文 + docs/ 下所有文件了解项目现状。**

## 项目身份

- **名称**: JustNeedThink
- **仓库**: https://github.com/this1is1i/JustNeedThink.git
- **路径**: `D:\AAWorkSpeace\liteplay\JustNeedThink\`
- **定位**: Windows 桌面 Claude Code CLI GUI 外壳

## 核心原则

**spawn 官方 CLI 子进程，不直接调 API。** 通过 `--input-format stream-json --output-format stream-json` 通信，保持 100% 兼容。

## 技术栈

| 层 | 版本 | 备注 |
|----|------|------|
| 桌面 | Tauri 2.11 | WebView2 |
| 前端 | React 19 + TS 6.0 + Vite 8 + Tailwind 4 | Vite 8 需单独装 esbuild |
| 状态 | Zustand 5 | per-tab Map 模式, 10 stores |
| DB | SQLite rusqlite 0.31 bundled | WAL 模式, 增量迁移 |
| 编辑 | CodeMirror 6 | 8+ 语言高亮 |
| 安装 | NSIS (currentUser) | 不侵入注册表 |

## 当前进度 (8/8 完成)

| Phase | 内容 | 提交 |
|:-----:|------|------|
| 0 | 脚手架 | ab9d4ff |
| 1 | CLI 集成 + 基础聊天 | 26335f7 |
| 2 | 文件系统 + SQLite 持久化 | c341c72 |
| 3 | 多项目系统 | 75d962f |
| 4 | Credit 追踪 | 4a82729 |
| 5 | 命令面板 + 快捷键 | 79425cb |
| 6 | Agent 管理 + 协作 | 0843c5c |
| 7 | Workflow 系统 | 6a7c44c |
| 8 | Skill 管理 + 打包 | 0f85c2e |
| 🐛 | Bug 修复 (10 个) | f09543c |

## 已实现模块

### Rust 后端 (40 个 .rs 文件, 31 个 Tauri 命令)

```
src-tauri/src/
├── main.rs, lib.rs, error.rs
├── cli/          process_manager (clone_arc) + stdin_manager + resolver (3级回退) + env_builder (git-bash 5路径)
├── session/      lifecycle (spawn/send/kill/list + cwd 验证 + stdout 30min 超时 + 退出清理)
├── stream/       parser (NDJSON) + protocol (SDK Control) + session_bridge
├── filesystem/   tree (深度控制) + ops (CRUD + 系统目录保护) + watcher (notify→fs:change)
├── db/           schema (WAL + v1迁移) + session_repo + project_repo
├── project/      registry + workspace + git (worktree)
├── agent/        registry (4 builtin) + team (2 default + 3 modes) + monitor (6 phases) + message_bus (pub/sub)
├── workflow/     engine (2 default模板 + DAG) + steps (状态转换) + context ({{var}}模板)
├── credit/       tracker (用量+百分比) + alert (70/90%阈值) + usage_stats
├── skill/        loader (扫描~/.claude/skills/ + .claude/skills/)
├── commands/     builtin (8 命令)
└── utils/        ansi (测试) + platform
```

### 前端 (24 个 .ts/.tsx 文件)

```
src/
├── App.tsx        日志栏 + SetupWizard + 三栏布局 + 右侧4标签切换
├── styles.css     Catppuccin dark/light 主题
├── lib/           tauri-bridge (31 invoke + 4 listen)
├── stores/        chatStore, fileStore, projectStore, agentStore,
│                  workflowStore, skillStore, creditStore, commandStore
├── hooks/         useStreamProcessor (activeRef竞态守卫+handlersRef)
└── components/
    ├── chat/      ChatPanel, InputBar, MessageBubble
    ├── files/     FileExplorer (递归+过滤+删除), FilePreview (CodeMirror 6)
    ├── projects/  ProjectList, ProjectCreateDialog
    ├── agents/    AgentPanel (实时轮询3s+定义+团队)
    ├── workflows/ WorkflowPanel (步骤可视化+类型徽章)
    ├── skills/    SkillsPanel (扫描+预览)
    ├── commands/  CommandPalette (Ctrl+K+模糊搜索)
    └── credits/   CreditIndicator (进度条+百分比)
```

## 关键设计模式

1. **tauri-bridge 唯一入口** — 所有 IPC 集中在一个文件
2. **per-tab Map** — `Map<tabId, TabData>` 并行会话
3. **不可变更新** — `new Map(oldMap); tabs.set(id, {...tab, ...}); set({tabs})`
4. **AppState 统一注入** — 通过 Tauri `manage()` + `State<>` 
5. **流桥接** — Rust stdout → `app.emit("claude:stream:{id}", json)` → `listen()`
6. **with_db() helper** — 数据库 Option 化，DB 不可用时返回友好错误而非 panic
7. **activeRef 竞态守卫** — useStreamProcessor 防止 stdinId 切换时回调冲突
8. **路径验证** — cwd 拒绝系统目录 + 文件写删操作保护 C:\Windows

## 踩过的坑

1. Vite 8 不内置 esbuild → `pnpm add -D esbuild`
2. Tauri 2 `bundle.targets` 不支持 `"portable"`
3. `serde_json::json!` 不支持 `as` 关键字
4. Windows `.cmd`/`.bat` 需 `cmd.exe /C` 包装
5. `CREATE_NO_WINDOW(0x08000000)` 隐藏控制台
6. wANG suitable for `Option<String>` fields use `.to_string()` not `.into()`
7. StdinManager/ProcessManager 需手动在进程退出后清理
8. DB 不可用时不应 panic → Option化 + with_db()

## 验证检查清单

每次改动后必须通过：
- `cargo check` — Rust 编译
- `cargo test` — Rust 测试 (13/13)
- `npx tsc -b` — TypeScript 类型检查
- `pnpm build` — Vite 前端构建

## 待实现功能

以下在架构中规划但未实现：
- [ ] Settings/Provider 配置面板
- [ ] 会话导出 (Markdown/JSON) 前端入口
- [ ] Session 历史加载 (SQLite → ChatPanel)
- [ ] 自定义 Agent 创建 UI
- [ ] Workflow 实际执行引擎
- [ ] Toast 通知系统
- [ ] i18n 国际化
- [ ] 自动更新签名密钥

## 自定义 Skills

| Skill | 触发方式 | 用途 |
|-------|---------|------|
| iter-fix | `/iter-fix` | 自动"构建→运行→调试→修复"闭环 |
| record-qa | "记录到QA里" | 追加技术问答到 docs/QA_*.md |
| qa-git-track | `/qa-git-track` | QA 与 git commit hash 绑定 |
| agent-reach | 搜索/调研自动触发 | 15 平台互联网搜索 |
