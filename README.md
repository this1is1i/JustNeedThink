# JustNeedThink

> Claude Code CLI 的 Windows 桌面 GUI 外壳 — 图形化操作 CLI，保持 100% 兼容。

## 是什么？

JustNeedThink 把 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 的命令行操作封装为原生 Windows 桌面应用。它**不直接调 API**，而是在后台 spawn 官方 CLI 子进程，通过 NDJSON stream-json 协议双向通信。所有 CLI 能力（sub-agents、MCP、hooks、skills、claude.md）保持 100% 兼容。

## 功能亮点

| 功能 | 说明 |
|------|------|
| 🔄 **并行会话** | 多项目、多会话并行运行，per-tab 独立状态 |
| 📁 **文件浏览器** | 递归文件树 + CodeMirror 6 多语言语法高亮预览 |
| 💰 **Credit 追踪** | 实时 token 用量进度条 + 日限额百分比 + 告警阈值 |
| 🤖 **Agent 协作** | 4 个内置 Agent (Architect/Explorer/Implementer/Guardian) + 2 个 Team |
| ⚡ **Workflow 引擎** | YAML 定义的工作流 + DAG 步骤可视化 |
| 🔧 **Skill 管理** | 扫描 global/project 目录的 SKILL.md + 预览/编辑 |
| ⌨️ **命令面板** | Ctrl+K 模糊搜索 (精确 > 前缀 > 包含匹配) |
| 🎨 **双主题** | Catppuccin 风格的暗色/亮色主题 |
| 📦 **便携安装** | NSIS currentUser 安装，不侵入注册表 |

## 系统要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Windows | Windows 10+ | x86_64 |
| Node.js | 18+ | CLI 需要 npm 全局安装 |
| Claude Code CLI | 最新版 | `npm install -g @anthropic-ai/claude-code` |
| Git Bash | 任意版本 | Windows 下 CLI 的必要依赖 |

**可选依赖（开发构建时需要）：**
- Rust 1.77+ (MSVC toolchain)
- Visual Studio 2022 Build Tools (C++ 桌面开发工作负载)
- pnpm 8+

## 快速开始（用户）

### 1. 安装 Claude Code CLI

```powershell
npm install -g @anthropic-ai/claude-code
claude --version  # 验证安装
```

### 2. 下载并运行

从 [GitHub Releases](https://github.com/this1is1i/JustNeedThink/releases) 下载最新 `JustNeedThink_*.exe` 安装包。

- **安装版** (NSIS): 双击安装，仅对当前用户安装，不侵入注册表
- **便携版**: 直接双击运行

### 3. 配置

首次启动时应用会自动检测 Claude CLI。如果未找到，SetupWizard 会引导你完成安装。

- 点击 **"+ Add"** 添加项目目录
- 在底部输入框输入消息，开始与 Claude 对话
- 按 **Ctrl+K** 打开命令面板

## 开发

### 环境准备

```powershell
# 1. 安装 Rust (MSVC toolchain)
# 访问 https://rustup.rs/ 下载 rustup-init.exe

# 2. 安装 Node.js + pnpm
# 访问 https://nodejs.org/ 下载 LTS
npm install -g pnpm

# 3. 克隆仓库
git clone https://github.com/this1is1i/JustNeedThink.git
cd JustNeedThink

# 4. 安装依赖
pnpm install
```

### 开发命令

```bash
# 前端开发服务器 (端口 5173)
pnpm dev

# 前端类型检查 + 构建
pnpm build

# Tauri 开发模式 (前端 + Rust 后端，热重载)
pnpm tauri dev

# Tauri 生产构建 (生成 .exe 安装包)
pnpm tauri build

# Rust 编译检查
cd src-tauri && cargo check

# Rust 测试
cd src-tauri && cargo test

# Rust 代码格式化 + Lint
cd src-tauri && cargo fmt && cargo clippy
```

### 项目结构

```
JustNeedThink/
├── src/                          # 前端 (React 19 + TypeScript + Tailwind 4)
│   ├── App.tsx                   # 入口：三栏布局 + SetupWizard + ErrorBoundary
│   ├── styles.css                # Tailwind + Catppuccin 暗色/亮色主题变量
│   ├── stores/                   # Zustand 5 状态管理 (10 个 store)
│   │   ├── chatStore.ts          # 消息/流式状态 (per-tab Map)
│   │   ├── sessionStore.ts       # 会话列表/选择/并行标签
│   │   ├── projectStore.ts       # 多项目 CRUD/切换
│   │   ├── agentStore.ts         # Agent 定义/团队/活跃状态
│   │   ├── workflowStore.ts      # Workflow 定义
│   │   ├── skillStore.ts         # Skill 列表/内容
│   │   ├── creditStore.ts        # 用量汇总/告警
│   │   ├── fileStore.ts          # 文件树/预览
│   │   ├── commandStore.ts       # 命令面板/模糊搜索
│   │   └── (settingsStore)       # 待实现
│   ├── hooks/
│   │   └── useStreamProcessor.ts # NDJSON 流处理核心
│   ├── lib/
│   │   └── tauri-bridge.ts       # 所有 Tauri IPC 调用 (单一入口)
│   └── components/
│       ├── layout/               # AppShell, Sidebar
│       ├── chat/                 # ChatPanel, InputBar, MessageBubble
│       ├── files/                # FileExplorer, FilePreview (CodeMirror 6)
│       ├── projects/             # ProjectList, ProjectCreateDialog
│       ├── agents/               # AgentPanel (实时状态/定义/团队)
│       ├── workflows/            # WorkflowPanel (步骤可视化)
│       ├── skills/               # SkillsPanel (扫描/预览)
│       ├── commands/             # CommandPalette (Ctrl+K 模糊搜索)
│       ├── credits/              # CreditIndicator (进度条)
│       └── shared/               # MarkdownRenderer, Toast, etc.
├── src-tauri/                    # Rust 后端 (Tauri 2)
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 配置 (窗口/打包/更新)
│   └── src/
│       ├── lib.rs                # Tauri builder + 31 个命令注册 + AppState
│       ├── main.rs               # Windows 子系统入口
│       ├── error.rs              # 统一错误类型 (thiserror)
│       ├── cli/                  # CLI 生命周期
│       │   ├── process_manager.rs
│       │   ├── stdin_manager.rs
│       │   ├── resolver.rs       # Claude 二进制发现 (3 级回退)
│       │   └── env_builder.rs    # Windows PATH/git-bash 检测
│       ├── session/              # 会话管理
│       │   └── lifecycle.rs      # spawn/send/kill + stdout 异步读取
│       ├── stream/               # NDJSON 流解析
│       │   ├── parser.rs         # 行级解析 + 消息分发
│       │   ├── protocol.rs       # SDK Control Protocol 类型
│       │   └── session_bridge.rs
│       ├── filesystem/           # 文件操作
│       │   ├── tree.rs           # 文件树构建 (深度控制)
│       │   ├── ops.rs            # CRUD 操作
│       │   └── watcher.rs        # notify 文件监听
│       ├── db/                   # SQLite 持久化
│       │   ├── schema.rs         # WAL 模式 + 迁移系统
│       │   ├── session_repo.rs   # 会话 CRUD
│       │   └── project_repo.rs   # 项目 CRUD
│       ├── project/              # 多项目管理
│       │   ├── registry.rs       # 项目数据结构
│       │   ├── workspace.rs      # .justneedthink/ 工作目录
│       │   └── git.rs            # Git worktree 隔离
│       ├── agent/                # Agent 系统
│       │   ├── registry.rs       # 4 内置 Agent 定义
│       │   ├── team.rs           # 2 默认 Team + 3 协作模式
│       │   ├── monitor.rs        # 6 阶段状态监控
│       │   └── message_bus.rs    # 消息 pub/sub
│       ├── workflow/             # Workflow 引擎
│       │   ├── engine.rs         # 2 默认模板 + DAG 步骤
│       │   ├── steps.rs          # 步骤状态转换
│       │   └── context.rs        # {{variable}} 模板解析
│       ├── credit/               # Credit 追踪
│       │   ├── tracker.rs        # 用量累加 + 百分比
│       │   ├── alert.rs          # 70%/90% 告警阈值
│       │   └── usage_stats.rs    # 历史统计
│       ├── skill/                # Skill 管理
│       │   └── loader.rs         # 扫描 .claude/skills/
│       ├── commands/             # 命令系统
│       │   └── builtin.rs        # 8 内置命令
│       └── utils/                # 工具
│           ├── ansi.rs           # ANSI 转义序列剥离
│           └── platform.rs       # 平台工具
└── docs/                         # 项目文档
    ├── memory.md                 # 项目记忆 (开发前必读)
    ├── 01-architecture.md        # 架构设计
    └── 02-08-phase*-complete.md  # 各阶段完成报告
```

### 核心数据流

```
用户输入 → InputBar → sendMessage()
  → bridge.startSession() → Rust spawn Claude CLI
  → stdout NDJSON → stream parser → Tauri events → useStreamProcessor
  → chatStore更新 → React 渲染消息气泡
  → creditStore更新 → CreditIndicator 进度条
  → agentStore更新 → AgentPanel 监控
```

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri 2 | 2.11 |
| 前端 | React + TypeScript | 19 + 5.8 |
| 样式 | Tailwind CSS 4 | 4.3 |
| 状态管理 | Zustand | 5.x |
| 代码编辑 | CodeMirror 6 | 6.x |
| 构建 | Vite | 8.x |
| 包管理 | pnpm | 10.x |
| 后端 | Rust (tokio) | 1.96 |
| 数据库 | SQLite (rusqlite, bundled) | 0.31 |
| CLI 通信 | NDJSON stream-json | - |

## 已知问题

见 [docs/known-issues.md](docs/known-issues.md) — 代码审查中发现的潜在问题列表。

## 许可证

Apache License 2.0
