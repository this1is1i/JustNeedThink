# Bug 修复日志

> 记录所有已修复的 bug，含根因分析、修复方案、验证结果。

---

## Fix #1: CLI 检测失败 — claude.exe 未被发现 (2026-07-07)

**提交**: ca35a5f

**现象**: 应用启动后 SetupWizard 显示 "Claude CLI not found"，但 `claude.exe` 已安装在 `C:\Users\Eternity\.local\bin\claude.exe`。

**根因**: `src-tauri/src/cli/resolver.rs:155-161`
```rust
fn claude_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "claude.cmd"    // ❌ 强制搜索 .cmd，独立 exe 安装不会被发现
    } else {
        "claude"
    }
}
```
`where claude.cmd` 只能找到 `.cmd` 后缀的文件。当用户通过非 npm 方式安装（如直接下载 exe 到 PATH 目录）时，文件名为 `claude.exe`，搜索失败。

**修复**: 拆分为两个函数：
- `npm_claude_binary_name()` — npm global 检查仍用 `claude.cmd`（npm 的 shim 确实是 `.cmd`）
- `sys_claude_binary_name()` — 系统 PATH 搜索用 `claude`（`where claude` 可匹配 `.exe`、`.cmd`、`.bat`）

**验证**: `cargo check` ✅ · `cargo test` 13/13 ✅ · 实际运行 `pnpm tauri dev` 能检测到 Claude CLI

---

## Fix #2: 程序关闭后终端窗口闪现 (2026-07-07)

**提交**: fa7a03e

**现象**: 关闭 JustNeedThink 后，若干个 cmd 终端窗口短暂闪现后消失。

**根因**: `src-tauri/src/session/lifecycle.rs:262-267`
```rust
#[cfg(target_os = "windows")]
{
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000); // ❌ 仅 CREATE_NO_WINDOW
}
```
`CREATE_NO_WINDOW` (0x08000000) 只隐藏 Rust 直接 spawn 的那个进程的窗口。当 Claude CLI 内部通过 `cmd /C` 或直接 spawn 子进程执行工具（git、npm、node 等）时，这些子进程会**继承父进程的控制台**，从而创建可见窗口。

**修复**:
```rust
cmd.creation_flags(0x08000000 | 0x00000008);
// CREATE_NO_WINDOW | DETACHED_PROCESS
```
`DETACHED_PROCESS` (0x00000008) 让进程完全脱离调用者的控制台，所有子进程也不会继承终端，从而消除所有闪现窗口。

**验证**: `cargo check` ✅ · 实际运行后关闭应用不再出现闪现终端

---

## Fix #3: 发送消息后页面空白/崩溃 (2026-07-07)

**提交**: fa7a03e

**现象**: 发送消息后，Claude CLI 在 thinking 阶段输出部分内容后，整个页面变成空白，不响应任何操作。

**根因分析**:
1. **主要根因**: `src/App.tsx` 的 ErrorBoundary 实现错误
   ```tsx
   // ❌ 这不是 React 错误边界！只能捕获初始化时的同步异常
   export default function App() {
     const [error, setError] = useState<Error | null>(null);
     if (error) return <ErrorFallback ... />;
     try { return <AppShell />; } catch { return null; }
   }
   ```
   React 的 `try/catch` **不能捕获组件渲染期抛出的异常**。当流消息处理器（useStreamProcessor）遇到未预期的 NDJSON 格式，或者 ChatPanel 渲染时抛出异常，React 会直接卸载整个组件树，表现为白屏。正确的错误边界必须使用 `componentDidCatch` / `getDerivedStateFromError` 生命周期。

2. **次要根因**: `useStreamProcessor` 的流回调无异常保护
   ```typescript
   onClaudeStream(stdinId, (message) => {
     handleStreamMessage(message, tabId, ...); // 无 try-catch
   });
   ```
   如果 Claude CLI 返回了非预期的 NDJSON 结构（如新增的消息类型字段），`handleStreamMessage` 内的类型断言可能抛出异常，直接传播到 React 渲染层。

**修复**:

1. **正确的 ErrorBoundary** (`src/App.tsx`):
   ```tsx
   class AppErrorBoundary extends Component<Props, State> {
     static getDerivedStateFromError(error: Error) {
       return { error };
     }
     componentDidCatch(error: Error, info: React.ErrorInfo) {
       console.error('[AppErrorBoundary]', error.message, info.componentStack);
     }
     render() {
       if (this.state.error) {
         return <ErrorFallback error={...} onReset={...} />;
       }
       return this.props.children;
     }
   }
   ```

2. **流回调 try-catch 保护** (`src/hooks/useStreamProcessor.ts`):
   ```typescript
   onClaudeStream(stdinId, (message) => {
     if (!activeRef.current) return;
     try {
       handleStreamMessage(message, tabId, {...});
     } catch (err) {
       console.error('[stream] Message handler error:', err);
     }
   });
   ```

**验证**: `tsc -b` ✅ · `pnpm build` ✅ · 错误回退页面正常显示 "Something went wrong" + Reload 按钮

---

## Fix #4: 数据库打开失败导致应用 panic (2026-07-07)

**提交**: f09543c (包含多个修复)

**现象**: 当 SQLite 数据库文件所在目录不可写、磁盘满或文件损坏时，应用启动即崩溃（进程直接退出），用户看到的是 "程序已停止工作" 而非友好提示。

**根因**: `src-tauri/src/lib.rs:260`
```rust
let db = schema::open_database().expect("Failed to open database");
// ❌ expect() 在 Result::Err 时直接 panic!()
```

**修复**:
1. `AppState.db` 类型从 `Arc<TokioMutex<Connection>>` 改为 `Option<Arc<TokioMutex<Connection>>>`
2. `run()` 中 `expect()` → `ok()`，失败时记录 `log::error!` 但不阻止应用启动
3. 新增 `with_db()` helper，所有 10 个数据库/项目命令统一通过它访问：
   ```rust
   async fn with_db<F, R>(&self, f: F) -> Result<R, String>
   where F: FnOnce(&Connection) -> Result<R, String>
   {
       let arc = self.db.as_ref().ok_or_else(|| 
           "Database is temporarily unavailable. Your data is safe — restart the app to retry."
       )?;
       let db = arc.lock().await;
       f(&db)
   }
   ```

**验证**: `cargo check` ✅ · `cargo test` 13/13 ✅

---

## Fix #5: CLI 进程退出后资源泄漏 (2026-07-07)

**提交**: f09543c

**现象**: CLI 进程结束（正常退出或用户 kill）后，`ProcessManager` 和 `StdinManager` 中残留僵尸条目。后续对该 stdinId 的 `send_stdin` 调用会尝试写入已关闭的管道，报错但不清理。

**根因**: `src-tauri/src/session/lifecycle.rs:108-110`
```rust
tokio::spawn(async move {
    read_stdout_stream(app_clone, child_stdout, &stdin_id_clone).await;
    // ❌ 进程退出后没有清理 ProcessManager / StdinManager
});
```
stdout reader 检测到 EOF 后发射 `claude:exit` 事件给前端，但**从未调用后端清理**。

**修复**:
1. `ProcessManager` 新增 `clone_arc()` 方法：
   ```rust
   pub fn clone_arc(&self) -> Self {
       Self { processes: self.processes.clone() }
   }
   ```
2. stdout reader spawn 块中，进程退出后主动清理：
   ```rust
   tokio::spawn(async move {
       read_stdout_stream(...).await;
       sm.remove(&stdin_id_stdout).await;  // 清理 stdin handle
       pm.remove(&stdin_id_stdout).await;  // 清理 process handle
   });
   ```

**验证**: `cargo check` ✅ · `cargo test` 13/13 ✅

---

## Fix #6: Stream 处理器竞态条件 (2026-07-07)

**提交**: f09543c

**现象**: 快速切换会话标签时，旧会话的流消息可能被路由到新会话的 tabId，导致消息错乱。

**根因**: `src/hooks/useStreamProcessor.ts:20-50`
```typescript
useEffect(() => {
    // 异步注册 listener
    onClaudeStream(newStdinId, callback).then(unlisten => cleanups.push(unlisten));
    
    return () => {
        cleanups.forEach(fn => fn()); // ❌ 旧 listener 可能注册得比新 listener 晚
    };
}, [stdinId, tabId]);
```
`onClaudeStream()` 是异步的（Promise），如果新旧两个 effect 几乎同时执行，新 effect 的 `.then()` 可能先于旧 effect 的 `.then()` 完成。cleanup 函数执行时可能 unlisten 了错误的 listener。

**修复**:
1. 添加 `activeRef` 守卫 —— cleanup 时将 ref 设为 false，回调检查 ref 后才执行
2. 添加 `handlersRef` 稳定引用 —— 避免回调闭包捕获过期的 store dispatchers

```typescript
useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; }; // 标记失效
}, [stdinId, tabId]);

onClaudeStream(stdinId, (message) => {
    if (!activeRef.current) return; // 守卫：旧 session 回调被忽略
    // ...
});
```

**验证**: `tsc -b` ✅ · `pnpm build` ✅

---

## Fix #7: CLI 进程无超时 (2026-07-07)

**提交**: f09543c

**现象**: 如果 Claude CLI 进程挂死（网络中断、API 超时等），stdout reader 的 `while let Ok(Some(line))` 循环永久阻塞 tokio 任务，内存和文件句柄泄漏。

**根因**: `src-tauri/src/session/lifecycle.rs:272-280`
```rust
async fn read_stdout_stream(...) {
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        // ❌ 无超时，永久等待下一行
    }
}
```

**修复**: 用 `tokio::time::timeout` 包装每次 `next_line()` 调用：
```rust
loop {
    let line_result = tokio::time::timeout(
        Duration::from_secs(1800),  // 30 分钟无活动超时
        lines.next_line()
    ).await;
    match line_result {
        Ok(Ok(Some(l))) => { /* 正常处理 */ }
        Ok(Ok(None)) => break,      // EOF
        Ok(Err(_)) => break,        // 读错误
        Err(_elapsed) => {          // 超时
            log::warn!("Reader timed out after 30min");
            break;
        }
    }
}
```

**验证**: `cargo check` ✅ · `cargo test` 13/13 ✅

---

## Fix #8: 其他修复 (2026-07-07)

**提交**: f09543c

| Fix | 文件 | 问题 | 修复 |
|-----|------|------|------|
| H1: unwrap panic | `lib.rs:268` | `app.get_webview_window("main").unwrap()` | → `if let Some(window)` |
| H6: 多会话硬编码 | `App.tsx` | 所有逻辑 `tabId='main'` | → `activeSessionId` 状态替代 |
| H3: 无路径验证 | `session/lifecycle.rs` | cwd 直接传给 CLI | → 验证存在/是目录/非系统目录 |
| H4: 文件操作无保护 | `filesystem/ops.rs` | write/delete 可操作任意路径 | → `validate_path_not_system()` 阻止 C:\Windows |
| L1: 硬编码默认路径 | `App.tsx:195` | `'D:\\AAWorkSpeace\\liteplay'` | → 空字符串 |
| L2: key 滥用 | `App.tsx:249` | `key={Date.now()}` 导致重挂载 | → 移除 key |

---

## 修复统计

| 严重级别 | 已修复 | 未修复 |
|----------|:---:|:---:|
| CRITICAL | 4/4 | 0 |
| HIGH | 5/6 | 1 (H2: Credit 持久化 — 需较大重构) |
| MEDIUM | 0/7 | 7 (计划后续迭代) |
| LOW | 2/6 | 4 (非阻塞) |
| **总计** | **11** | **12** |

剩余 13 个未修复问题参见 `docs/known-issues.md`。
