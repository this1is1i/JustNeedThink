# 待实现功能清单

> 日期: 2026-07-07
> 对应 Rust warning: 28 个 `dead_code` 均来自以下预留骨架

---

## Phase 6 — Agent 协作 (需工作量: 中)

| 预留代码 | 目标功能 | 当前状态 |
|---------|---------|---------|
| `agent/monitor.rs` | CLI spawn 子 agent 时自动注册状态到 AgentPanel | ✅ 数据结构就绪；❌ stream parser 未检测 `content_block_start` |
| `agent/message_bus.rs` | Agent 间 pub/sub 消息（DelegateTask/TaskResult/RequestInfo） | ✅ 通道就绪；❌ 无调用方 |
| `agent/team.rs` | Sequential/Parallel/Review 三种协作模式实际执行 | ✅ 定义就绪；❌ 无执行逻辑 |

## Phase 7 — Workflow 执行 (需工作量: 大)

| 预留代码 | 目标功能 | 当前状态 |
|---------|---------|---------|
| `workflow/engine.rs` | WorkflowRun+StepRun 运行实例 | ✅ 数据结构就绪；❌ 无 Tauri 命令触发 |
| `workflow/steps.rs` | 步骤状态机 Pending→Running→Completed/Failed/Skipped | ✅ 函数就绪；❌ 无执行器调用 |
| `workflow/context.rs` | {{variable}} 模板解析+跨步骤输出引用 | ✅ 解析器就绪；❌ 未集成到执行流程 |

## Phase 8 — Skill 完整管理 (需工作量: 小)

| 预留代码 | 目标功能 | 当前状态 |
|---------|---------|---------|
| `skill/loader.rs:delete_skill` | SkillsPanel 删除按钮 | ✅ 后端就绪；❌ 前端无调用 |

## 其他预留

| 文件 | 目标功能 | 当前状态 |
|------|---------|---------|
| `commands/builtin.rs` 8 命令 | 命令面板执行分发 (Chat/Project/View/Credit/Settings) | ✅ 注册就绪；❌ 执行 `console.log` |
| `credit/alert.rs` | 70%/90% 额度告警 Toast 通知 | ✅ 逻辑就绪；❌ 无前端消费 |
| `credit/usage_stats.rs` | 日用量历史从 SQLite 读取 | ✅ 函数骨架；❌ 空实现 |
| `db/session_repo.rs:get_session` | 关闭后恢复会话历史 | ✅ 查询就绪；❌ ChatPanel 不加载 |
| `project/git.rs:create_worktree` | Agent 并行工作 git worktree 隔离 | ✅ 实现就绪；❌ Agent 模式未调用 |
| `project/git.rs:remove_worktree` | 清理用完的 worktree | ✅ 实现就绪；❌ 同上 |
| `stream/protocol.rs:ControlRequest` | SDK Control Protocol 权限审批 | ✅ 类型就绪；❌ 未拦截 control_request |
| `filesystem/watcher.rs` | 文件变更实时刷新文件树 | ✅ Tauri 命令已注册；❌ 前端未调用 `watch_directory` |

## 实现顺序建议

```
1. 会话历史加载 (小) → 关闭后再打开能看到之前的对话
2. 文件监听实时刷新 (小) → 文件树自动更新
3. Agent 子进程监控 (中) → AgentPanel 能看到实时状态
4. Credit 历史图表 (小) → 用量可视化
5. Agent 消息总线 (中) → 多 Agent 协作
6. Workflow 执行引擎 (大) → YAML 工作流真正可运行
7. Skill 删除+编辑 (小) → 完整 Skill 管理
8. 命令面板执行 (小) → Ctrl+K 不只是展示
9. Worktree 隔离 (中) → Agent 安全并行
10. 权限审批协议 (中) → SDK Control Protocol 对话
```
