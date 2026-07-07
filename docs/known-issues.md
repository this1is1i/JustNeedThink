# 代码审查：已知问题

> 日期: 2026-07-07
> 审查范围: 全部 Rust 后端 (40 .rs) + 前端 (24 .ts/.tsx) + 配置文件

---

## 🔴 CRITICAL（影响稳定性/安全性）

### C1. 数据库打开失败直接 panic

**位置**: `src-tauri/src/lib.rs:260`
```rust
let db = schema::open_database().expect("Failed to open database");
```
**问题**: 如果 SQLite 数据库无法打开（磁盘满、权限不足、文件损坏），应用直接 crash，用户看到的是进程崩溃而非友好提示。
**修复**: 改为 `match` 处理，通过 Tauri dialog 显示错误信息，或在 Setup 阶段做降级处理。

---

### C2. CLI 进程无超时机制，存在资源泄漏风险

**位置**: `src-tauri/src/session/lifecycle.rs:130-150` (stdout reader loop)
**问题**: 如果 Claude CLI 进程挂死，`read_stdout_stream` 的 `while let Ok(Some(line))` 循环将永久阻塞 tokio 任务。ProcessManager 中的进程永远不会被清理，导致内存和进程句柄泄漏。
**修复**: 为 stdout/stderr reader 添加 `tokio::time::timeout` 包装；在进程退出后自动从 ProcessManager 移除。

---

### C3. 进程退出后未清理 ProcessManager

**位置**: `src-tauri/src/session/lifecycle.rs:295` (exit event emit)
```rust
let _ = app.emit(&event_name, serde_json::json!({ "code": serde_json::Value::Null }));
```
**问题**: 进程退出时只发射 Tauri 事件，但 **从未调用** `state.process_manager.remove()` 或 `state.stdin_manager.remove()`。StdinManager 中残留的 `ChildStdin` handle 可能导致后续的 `send_stdin` 尝试写入已关闭的管道。
**修复**: 在 exit handler 中调用 `state.process_manager.remove(&stdin_id)` 和 `state.stdin_manager.remove(&stdin_id)`。

---

### C4. 流处理器清理竞态条件

**位置**: `src/hooks/useStreamProcessor.ts:20-50`
```typescript
useEffect(() => {
    if (!stdinId) return;
    const cleanups: Array<() => void> = [];
    onClaudeStream(stdinId, ...).then(unlisten => cleanups.push(unlisten));
    // ...
    return () => { cleanups.forEach(fn => fn()); };
}, [stdinId, tabId]);
```
**问题**: 当 `stdinId` 快速切换时（如快速切换会话），旧的异步 `onClaudeStream().then()` 可能在新的 effect 已经运行后才 resolve，导致：
- 新 listener 的 unlisten 被旧的 cleanup 意外移除
- 旧 listener 没有正确 unlisten，继续向错误的 tabId 推送消息
**修复**: 使用 AbortController 或 ref 追踪当前 effect 是否已失效；在注册新的 listener 前先取消旧的 pending promise。

---

## 🟠 HIGH（功能缺陷/安全隐患）

### H1. unwrap() 可能导致 panic

**位置**: `src-tauri/src/lib.rs:268`
```rust
let _window = app.get_webview_window("main").unwrap();
```
**问题**: 如果 tauri.conf.json 中窗口配置异常（多窗口、窗口未创建），`unwrap()` 直接 panic。
**修复**: 改为 `app.get_webview_window("main").expect("Main window must exist")` 或 `if let Some(window) = ...`。

---

### H2. Credit 用量无持久化

**位置**: `src/stores/creditStore.ts` + `src-tauri/src/credit/tracker.rs`
**问题**: Credit 数据完全在内存中（客户端 Zustand + 服务端 `Arc<Mutex<CreditSummary>>`）。应用重启后所有用量归零。日限额重置逻辑 (`reset_daily`) 从未被调用——没有 cron/scheduler。
**修复**: CreditTracker 应写入 SQLite `credit_events` 表；日重置通过在 `add_usage` 时检查日期变更实现。

---

### H3. 无路径遍历保护

**位置**: `src-tauri/src/session/lifecycle.rs:175` (current_dir)
```rust
cmd.current_dir(&params.cwd);
```
**问题**: `cwd` 参数直接来自前端用户输入，没有验证。恶意或错误的路径（如 `C:\Windows\System32`）会被直接传给 CLI 进程。
**修复**: 验证 `cwd` 指向存在的目录；可选：限制在配置的 workspace 范围内。

---

### H4. 文件操作无路径限制

**位置**: `src-tauri/src/filesystem/ops.rs` (write_file_content, delete_file)
**问题**: 前端可以调用 `write_file_content` / `delete_file` 操作任意系统路径。FileExplorer 虽然只显示项目目录，但 IPC 命令层没有路径边界检查。
**修复**: 在 Rust 命令层添加路径白名单检查，确保文件操作不超出项目目录。

---

### H5. CSP 设为 null — 无内容安全策略

**位置**: `src-tauri/tauri.conf.json:27`
```json
"security": { "csp": null }
```
**问题**: Content Security Policy 为 null 意味着浏览器 WebView 不执行任何来源限制。如果有 XSS 漏洞（例如从消息内容中注入脚本），攻击面完全开放。
**修复**: 设置合理的 CSP，至少限制 `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`。

---

### H6. 多会话使用硬编码 'main' tabId

**位置**: `src/App.tsx:75, 167-174, 176-180`
```typescript
// sessionMeta only retrieved for 'main'
const sessionMeta = useChatStore((s) => s.tabs.get('main')?.sessionMeta);

// sessionSync only updates 'main'
setSessions((prev) => prev.map((s) => s.id === 'main' ? {...s, status} : s));

// ensureTab only creates 'main'
ensureTab('main');

// ChatPanel always passed tabId='main'
<ChatPanel tabId="main" cwd={cwd} />
```
**问题**: 虽然 UI 提供了 `handleNewSession` 创建新会话和 `handleSelectSession` 切换，但所有核心逻辑都硬编码为 `'main'`。创建新会话后无法真正使用它。
**修复**: 将 `activeSessionId` 状态提升，替代所有硬编码的 `'main'`。

---

## 🟡 MEDIUM（设计缺陷/体验问题）

### M1. Schema 版本查询吞错误

**位置**: `src-tauri/src/db/schema.rs:18-24`
```rust
let current: u32 = conn.query_row(..., |row| row.get(0)).unwrap_or(0);
```
**问题**: `unwrap_or(0)` 可能隐藏真实的 SQL 错误（如表损坏、磁盘错误），导致迁移逻辑错误地认为需要重跑 v1。
**修复**: 区分 "表不存在" 和真正的数据库错误。

---

### M2. `--dangerously-skip-permissions` 安全风险

**位置**: `src-tauri/src/session/lifecycle.rs:238`
```rust
if mode == "bypassPermissions" {
    cmd.arg("--dangerously-skip-permissions");
}
```
**问题**: bypass 模式完全跳过 CLI 权限检查。这在受信任环境中可能是便利功能，但可能被误用。
**修复**: 至少在前端显示 "⚠️ Bypass Mode" 警告，并在切换到 bypass 时确认对话框。

---

### M3. 目录递归复制无大小限制

**位置**: `src-tauri/src/filesystem/ops.rs:58-68` (copy_dir_recursive)
**问题**: `copy_file` 在目录上递归复制所有内容，没有总大小或文件数量限制。复制大型项目目录可能耗尽磁盘或超时。
**修复**: 添加总大小限制（如 500MB）或文件数量上限（如 10000）。

---

### M4. 项目创建无重复验证

**位置**: `src-tauri/src/db/project_repo.rs:10-19`
**问题**: `upsert_project` 在 name/path 上无 UNIQUE 约束。数据库 schema 有 `path TEXT NOT NULL UNIQUE`，但 Rust 代码在调用 upsert 前不预先检查，导致 SQL 错误以字符串形式返回前端。
**修复**: 在创建前检查同名/同路径项目，返回用户友好的错误。

---

### M5. Workflow 引擎无实际执行能力

**位置**: `src-tauri/src/workflow/engine.rs`
**问题**: 整个 workflow 模块只定义了数据结构和默认模板。`list_workflows` 返回硬编码数据，没有任何执行、调度或步骤推进逻辑。WorkflowRunner 组件不存在。
**修复**: 实现 `run_workflow` 命令，通过 `tokio::spawn` 异步执行步骤，实时更新状态。

---

### M6. Agent 监控完全被动

**位置**: `src-tauri/src/agent/monitor.rs`
**问题**: AgentMonitor 只是内存 HashMap + CRUD。没有与实际的 CLI 子进程集成——stream parser 不会在检测到 `Task` 工具调用时创建 AgentStatus 条目。AgentPanel 显示了内置 agent 定义但活跃状态列表始终为空。
**修复**: 在 `useStreamProcessor` 中添加 `content_block_start` 检测，当 CLI 产生子 agent 时自动在 AgentMonitor 中注册。

---

### M7. 自动更新 pubkey 为空

**位置**: `src-tauri/tauri.conf.json:48-52`
```json
"updater": { "pubkey": "" }
```
**问题**: 更新器公钥为空。Tauri 更新器依赖公私钥签名验证更新包完整性。没有公钥，更新功能实际上不可用。
**修复**: 运行 `pnpm tauri signer generate` 生成密钥对，将公钥填入此处。

---

## 🟢 LOW（代码质量/风格）

### L1. 硬编码默认路径

**位置**: `src/App.tsx:195`
```typescript
const cwd = activeProject?.path ?? 'D:\\AAWorkSpeace\\liteplay';
```
**修复**: 默认为空或用户 home 目录，而非开发者的工作目录。

---

### L2. `key={Date.now()}` 导致不必要的重挂载

**位置**: `src/App.tsx:249`
```typescript
return <AppShell key={Date.now()} />;
```
**问题**: 每次 App 渲染都生成新 key，导致 AppShell 完全卸载再挂载，丢失所有内部状态。
**修复**: 移除 key 或使用稳定的 key 值。

---

### L3. 错误处理静默吞

**位置**: 多处前端组件
```typescript
try { ... } catch { /* ignore */ }
try { ... } catch (err) { console.error('...', err); }
```
**问题**: 大量异步操作的错误被静默吞掉。用户看不到任何反馈。
**修复**: 引入全局 Toast 通知系统，在关键操作失败时提示用户。

---

### L4. Rust 未使用的导入

**位置**: `lib.rs:25`, `session/lifecycle.rs:245`
```rust
use tauri::{AppHandle, Emitter, Manager, State}; // Emitter unused
use std::os::windows::process::CommandExt; // unused
```
**修复**: 运行 `cargo fix` 自动清理。

---

### L5. `sendMessage` 未处理 sendStdin 失败

**位置**: `src/hooks/useStreamProcessor.ts:227-230`
```typescript
if (options.stdinId) {
    await bridge.sendStdin(options.stdinId, prompt);
    return options.stdinId;
}
```
**问题**: 如果 stdin 管道已关闭（进程已退出），`sendStdin` 会静默失败，用户以为消息已发送但实际没有。
**修复**: catch `sendStdin` 错误并回退到创建新 session。

---

### L6. TypeScript strictNullChecks 不一致

**问题**: 前端代码中混用 `null` 和 `undefined` 作为可选字段的默认值。Zustand store 的 `Map.get()` 返回 `undefined`，但 bridge 返回值可能为 `null`。
**修复**: 统一使用 `null` 表示 "无值"，`undefined` 仅用于 "未初始化"。在 Tauri bridge 层做 null/undefined 归一化。

---

## 未实现的关键功能

以下功能在架构设计中规划但尚未实现：

- [ ] **Settings/Provider 配置面板** — 无法配置 API key/model/base URL
- [ ] **会话导出 (Markdown/JSON)** — 后端有 session_repo 但前端无导出入口
- [ ] **Session 持久化加载** — SQLite 存储已实现，但 ChatPanel 启动时不会加载历史消息
- [ ] **自定义 Agent 创建** — AgentCreateForm 未实现
- [ ] **Workflow 实际执行** — 只有静态展示
- [ ] **Toast 通知系统** — 全局错误/成功反馈缺失
- [ ] **i18n 国际化** — 翻译模块未创建

---

## 总结

| 严重级别 | 数量 |
|----------|------|
| CRITICAL | 4 |
| HIGH | 6 |
| MEDIUM | 7 |
| LOW | 6 |
| **总计** | **23** |

**建议优先修复顺序**: C1 (panic) → C3 (资源泄漏) → H1 (unwrap) → H6 (多会话硬编码) → H3/H4 (路径安全) → C4 (竞态) → C2 (超时)
