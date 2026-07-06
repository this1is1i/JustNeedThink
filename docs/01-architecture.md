# JustNeedThink — 架构设计文档

> 日期: 2026-07-07
> 版本: v0.1.0-phase0

## 1. 项目定位

在 `D:\AAWorkSpeace\liteplay\JustNeedThink\` 下构建 Windows 桌面应用，作为 Claude Code CLI 的图形化外壳。

核心原则：**spawn 官方 CLI 子进程，不直接调 API**。所有 CLI 能力（sub-agents, MCP, hooks, skills, claude.md）保持 100% 兼容。

## 2. 技术栈

| 层级 | 选型 | 原因 |
|------|------|------|
| 桌面框架 | Tauri 2 | ~30MB，Rust 安全，系统 WebView |
| 前端 | React 19 + TypeScript + Tailwind CSS 4 | 生态成熟 |
| 状态管理 | Zustand 5 | 轻量，类型安全 |
| 代码编辑 | CodeMirror 6 | 满足文件预览/Skill编辑需求 |
| CLI 通信 | NDJSON stream-json + SDK Control Protocol | 官方 CLI 原生协议 |
| 数据持久化 | SQLite (rusqlite, bundled) | 零依赖，单文件 |
| 安装包 | NSIS (currentUser) + Portable .exe | 不侵入注册表 |

## 3. 架构图

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri 2 Window                        │
│  ┌──────────┬──────────────────┬──────────────────────┐  │
│  │ Sidebar  │    ChatArea      │  SecondaryPanel      │  │
│  │ Projects │  (Tabs: 并行会话) │  Files | Agents      │  │
│  │ Sessions │  Messages        │  | Workflows|Credits │  │
│  │ Agents   │  InputBar        │  | Skills             │  │
│  │ Credits  │                  │                      │  │
│  └──────────┴──────────────────┴──────────────────────┘  │
│               ↕ Tauri IPC (invoke + events)               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Rust Backend (模块化, ~70 文件)          │ │
│  │           ↕ stdin/stdout pipes (NDJSON)               │ │
│  │   Claude CLI (stream-json + SDK control protocol)    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## 4. Rust 后端模块

```
src-tauri/src/
├── main.rs                    # Windows 子系统入口
├── lib.rs                     # Tauri builder + command 注册 (~150 行)
├── error.rs                   # 统一错误类型 (thiserror)
├── cli/                       # CLI 生命周期
│   ├── process_manager.rs     # 进程 spawn/kill/track
│   └── stdin_manager.rs       # stdin 路由 + 原子写入
├── stream/                    # NDJSON 流解析
│   ├── parser.rs              # 行级解析 + 消息类型分发
│   ├── protocol.rs            # SDK Control Protocol 类型
│   └── session_bridge.rs      # 流事件 → Tauri events
├── session/                   # 会话管理 (待实现)
├── project/                   # 多项目管理 (待实现)
├── agent/                     # Agent 编排 (待实现)
├── workflow/                  # 工作流引擎 (待实现)
├── skill/                     # Skill 管理 (待实现)
├── commands/                  # 命令系统 (待实现)
├── filesystem/                # 文件操作
│   ├── tree.rs                # 文件树构建
│   ├── ops.rs                 # CRUD 操作
│   └── watcher.rs             # notify 文件监听
├── credit/                    # 额度追踪 (待实现)
├── db/                        # SQLite 持久化
│   └── schema.rs              # DDL + 迁移
├── auth/                      # 认证 (待实现)
├── settings/                  # 应用配置 (待实现)
└── utils/                     # 共享工具
    ├── ansi.rs                # ANSI 转义序列剥离
    └── platform.rs            # 平台工具
```

## 5. 前端组件树

```
src/
├── App.tsx                     # 入口：ErrorBoundary + AppShell
├── stores/                     # Zustand 5 状态管理
│   ├── chatStore.ts            # 消息、流式状态、per-tab 缓存
│   ├── sessionStore.ts         # 会话列表、选择、并行标签
│   ├── projectStore.ts         # 多项目管理
│   ├── agentStore.ts           # Agent 树、定义、团队
│   ├── workflowStore.ts        # Workflow 定义 + 执行
│   ├── skillStore.ts           # Skill CRUD
│   ├── creditStore.ts          # 额度汇总 + 告警
│   ├── fileStore.ts            # 文件树、预览
│   ├── commandStore.ts         # 命令面板状态
│   └── settingsStore.ts        # 主题/语言/Provider
├── hooks/
│   ├── useStreamProcessor.ts   # NDJSON 流处理 (核心)
│   ├── useCreditBalance.ts     # 额度实时解析
│   ├── useCommandPalette.ts    # 命令面板模糊搜索
│   └── useKeyboardShortcuts.ts # 快捷键处理
├── lib/
│   ├── tauri-bridge.ts         # 所有 Tauri IPC 调用
│   ├── i18n.ts                 # 中英文翻译
│   └── platform.ts             # OS 检测
└── components/
    ├── layout/                 # AppShell, Sidebar, SecondaryPanel
    ├── chat/                   # ChatPanel, InputBar, MessageBubble
    ├── projects/               # ProjectList, ProjectCreateWizard
    ├── agents/                 # AgentPanel, AgentTeamBuilder
    ├── workflows/              # WorkflowEditor, WorkflowRunner
    ├── skills/                 # SkillsPanel, SkillEditor
    ├── files/                  # FileExplorer, FilePreview
    ├── commands/               # CommandPalette
    ├── credits/                # CreditPanel, CreditHistory
    └── shared/                 # MarkdownRenderer, Toast, ConfirmDialog
```

## 6. 实施阶段

| Phase | 内容 | 验证标准 |
|-------|------|---------|
| 0 | 项目脚手架、模块骨架 | `pnpm tauri dev` 窗口启动 |
| 1 | CLI 集成 + 基础聊天 | 发送消息→CLI 进程→UI 渲染 |
| 2 | 文件系统 + SQLite 持久化 | 文件树浏览、会话导出 |
| 3 | 多项目系统 | 多项目切换、并行会话 |
| 4 | Credit 追踪 | 额度实时更新、历史图表 |
| 5 | 命令面板 + 快捷键 | Ctrl+K 模糊搜索、快捷键配置 |
| 6 | Agent 管理 + 协作 | Agent 定义、团队、状态监控 |
| 7 | Workflow 系统 | YAML 工作流、DAG 可视化 |
| 8 | Skill 管理 + 打包 | NSIS/Portable exe 发布 |
