import { useState, useCallback, useEffect, Component } from 'react';
import { useChatStore, generateMessageId, type ChatMessage } from './stores/chatStore';
import { useFileStore } from './stores/fileStore';
import { useProjectStore } from './stores/projectStore';
import { useCreditStore } from './stores/creditStore';
import { bridge, type CliStatus } from './lib/tauri-bridge';
import { CreditIndicator } from './components/credits/CreditIndicator';
import { CommandPalette } from './components/commands/CommandPalette';
import { AgentPanel } from './components/agents/AgentPanel';
import { WorkflowPanel } from './components/workflows/WorkflowPanel';
import { SkillsPanel } from './components/skills/SkillsPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { FileExplorer } from './components/files/FileExplorer';
import { FilePreview } from './components/files/FilePreview';
import { ProjectList } from './components/projects/ProjectList';
import { ProjectCreateDialog } from './components/projects/ProjectCreateDialog';

// --- Error Boundary ---

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="jnt-card jnt-animate-in max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: 'var(--color-error)' }}>⚠</div>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Something went wrong</h2>
        <p className="mb-5 break-words text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error.message}</p>
        <button onClick={onReset} className="jnt-btn-accent px-5 py-2 text-sm">Reload</button>
      </div>
    </div>
  );
}

// --- Setup Wizard ---

function SetupWizard({ cliStatus, onRetry }: { cliStatus: CliStatus; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="jnt-card jnt-gradient-border jnt-animate-in max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundImage: 'var(--gradient-accent)', color: '#04121a' }}>◆</div>
        <h2 className="mb-1 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Setup Required</h2>
        <p className="mb-5 text-xs" style={{ color: 'var(--color-text-muted)' }}>Connect the Claude CLI to get started</p>
        <div className="mb-5 space-y-2 rounded-xl border p-3 text-left text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <div className="flex items-center gap-2">
            <span>{cliStatus.installed ? '✅' : '❌'}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Claude CLI {cliStatus.installed ? `found (${cliStatus.version || 'unknown'})` : 'not found'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>{cliStatus.git_bash_available ? '✅' : '⚠️'}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Git Bash {cliStatus.git_bash_available ? 'found' : 'not found (required on Windows)'}
            </span>
          </div>
        </div>
        {!cliStatus.installed && (
          <p className="mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Run <code className="rounded px-1" style={{ backgroundColor: 'var(--color-bg)' }}>npm install -g @anthropic-ai/claude-code</code> in a terminal, then retry.
          </p>
        )}
        <button onClick={onRetry} className="jnt-btn-accent px-6 py-2 text-sm">Retry Detection</button>
      </div>
    </div>
  );
}

// --- Session List (per project) ---

interface SessionInfo {
  id: string;
  name: string;
  status: string;
  path?: string;
  modifiedAt?: number;
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === 'object')
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n');
  }
  return '';
}

function hydrateMessages(records: unknown[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const entry = record as Record<string, unknown>;
    const message = entry.message as Record<string, unknown> | undefined;
    if (!message) continue;
    const type = entry.type;
    if (type === 'user') {
      const content = messageText(message.content);
      if (content) messages.push({ id: generateMessageId(), role: 'user', type: 'text', content, isPartial: false, timestamp: Date.now() });
    } else if (type === 'assistant') {
      const content = messageText(message.content);
      if (content) messages.push({ id: generateMessageId(), role: 'assistant', type: 'text', content, isPartial: false, timestamp: Date.now() });
    }
  }
  return messages;
}

function SessionList({ sessions, activeId, onSelect, onDelete, onNew }: {
  sessions: SessionInfo[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const statusColor = (status: string) =>
    status === 'running' ? 'var(--color-accent)'
    : status === 'completed' ? 'var(--color-success)'
    : 'var(--color-text-muted)';

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sessions</span>
        <button onClick={onNew} title="New session"
          className="jnt-btn-ghost flex h-5 w-5 items-center justify-center text-sm leading-none">+</button>
      </div>
      <div className="max-h-[200px] overflow-y-auto px-1.5 pb-1.5">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`jnt-row mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ${s.id === activeId ? 'jnt-row-active' : ''}`}
          >
            <span className="jnt-dot h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: statusColor(s.status), color: statusColor(s.status) }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs" style={{ color: s.id === activeId ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                {s.name}
              </div>
            </div>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {s.status === 'running' ? 'running' : s.status === 'completed' ? 'done' : 'idle'}
            </span>
            <span
              role="button"
              title={s.status === 'running' ? 'Stop the session before deleting it' : 'Delete session'}
              onClick={(event) => {
                event.stopPropagation();
                if (s.status !== 'running') onDelete(s.id);
              }}
              className={`flex h-4 w-4 items-center justify-center rounded text-xs ${s.status === 'running' ? 'cursor-not-allowed opacity-30' : 'opacity-50 hover:opacity-100'}`}
              style={{ color: 'var(--color-error)' }}
            >×</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Main App ---

function AppShell() {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [rightTab, setRightTab] = useState<'files' | 'agents' | 'workflows' | 'skills'>('files');

  // Chat store
  const [activeSessionId, setActiveSessionId] = useState<string>('main');
  const ensureTab = useChatStore((s) => s.ensureTab);
  const removeTab = useChatStore((s) => s.removeTab);
  const setMessages = useChatStore((s) => s.setMessages);
  const setSessionMeta = useChatStore((s) => s.setSessionMeta);
  const sessionMeta = useChatStore((s) => s.tabs.get(activeSessionId)?.sessionMeta);
  const activeSessionStatus = useChatStore((s) => s.tabs.get(activeSessionId)?.sessionStatus);
  const activeSessionStreaming = useChatStore((s) => s.tabs.get(activeSessionId)?.isStreaming);

  // Project store
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const removeProject = useProjectStore((s) => s.removeProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const activeProject = useProjectStore((s) => s.getActiveProject());

  // File store
  const fileTree = useFileStore((s) => s.tree);
  const selectedFilePath = useFileStore((s) => s.selectedPath);
  const previewContent = useFileStore((s) => s.previewContent);
  const previewPath = useFileStore((s) => s.previewPath);
  const fileTreeLoading = useFileStore((s) => s.isLoading);
  const loadTree = useFileStore((s) => s.loadTree);
  const selectFile = useFileStore((s) => s.selectFile);
  const loadPreview = useFileStore((s) => s.loadPreview);
  const deleteFile = useFileStore((s) => s.deleteFile);
  const writeFile = useFileStore((s) => s.writeFile);

  // Credit store
  const creditSummary = useCreditStore((s) => s.summary);
  const fetchCreditSummary = useCreditStore((s) => s.fetchSummary);

  // Sessions
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  // Init
  const checkCli = useCallback(async () => {
    try {
      setCliStatus(await bridge.checkClaudeCli());
    } catch {
      // Bridge call failed — treat as CLI not installed so the setup wizard shows
      setCliStatus({ installed: false, path: null, version: null, git_bash_available: false });
    }
  }, []);

  useEffect(() => { checkCli(); fetchCreditSummary(); }, [checkCli, fetchCreditSummary]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { ensureTab(activeSessionId); }, [ensureTab, activeSessionId]);

  const refreshSessions = useCallback(async (projectPath: string) => {
    const diskSessions = await bridge.scanProjectSessions(projectPath);
    setSessions((current) => {
      const merged = new Map<string, SessionInfo>();
      for (const session of current) merged.set(session.id, session);
      for (const session of diskSessions) {
        const existing = merged.get(session.id);
        merged.set(session.id, {
          id: session.id,
          name: session.preview || session.id.slice(0, 8),
          status: existing?.status === 'running' ? 'running' : 'idle',
          path: session.path,
          modifiedAt: session.modifiedAt,
        });
      }
      return [...merged.values()]
        .filter((session) => session.path || session.status === 'running')
        .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
    });
  }, []);

  // Load file tree + persisted CLI sessions for the active project.
  useEffect(() => {
    if (activeProject) {
      loadTree(activeProject.path);
      void refreshSessions(activeProject.path).catch((err) => {
        console.error('Failed to scan session history:', err);
      });
    }
  }, [activeProject, loadTree, refreshSessions]);

  // Session status sync
  useEffect(() => {
    if (!sessionMeta) return;
    const tab = useChatStore.getState().tabs.get(activeSessionId);
    if (!tab) return;
    const status = tab.sessionStatus === 'running' || tab.isStreaming
      ? 'running' : tab.sessionStatus === 'completed' ? 'completed' : 'idle';
    setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, status } : s));
    if (status === 'completed' && activeProject) {
      void refreshSessions(activeProject.path).catch((err) => {
        console.error('Failed to refresh session history:', err);
      });
    }
  }, [sessionMeta, activeSessionId, activeSessionStatus, activeSessionStreaming, activeProject, refreshSessions]);

  const handleNewSession = useCallback(() => {
    // Use the same UUID for the UI tab and Claude's on-disk transcript.
    const id = crypto.randomUUID();
    setSessions((prev) => [...prev, { id, name: `Session ${prev.length}`, status: 'idle' }]);
    ensureTab(id);
    setSessionMeta(id, { sessionId: id });
    setActiveSessionId(id);
  }, [ensureTab, setSessionMeta]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    ensureTab(id);
    const session = sessions.find((item) => item.id === id);
    if (!session?.path) return;
    try {
      const records = await bridge.loadSessionContent(session.path);
      setMessages(id, hydrateMessages(records));
      // Reuse the CLI-recognised UUID when the user continues this session.
      setSessionMeta(id, { sessionId: id, stdinId: undefined });
    } catch (err) {
      console.error('Failed to load session history:', err);
    }
  }, [ensureTab, sessions, setMessages, setSessionMeta]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!activeProject) return;
    const session = sessions.find((item) => item.id === id);
    if (!session?.path || session.status === 'running') return;
    try {
      await bridge.deleteProjectSession(activeProject.path, id);
      setSessions((current) => current.filter((item) => item.id !== id));
      removeTab(id);
      if (activeSessionId === id) {
        const nextId = crypto.randomUUID();
        ensureTab(nextId);
        setSessionMeta(nextId, { sessionId: nextId });
        setActiveSessionId(nextId);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [activeProject, activeSessionId, ensureTab, removeTab, sessions, setSessionMeta]);

  const handleProjectSelect = useCallback(async (id: string) => {
    await setActiveProject(id);
  }, [setActiveProject]);

  const handleProjectDelete = useCallback(async (id: string) => {
    await removeProject(id);
  }, [removeProject]);

  const handleProjectCreate = useCallback(async (name: string, path: string) => {
    const proj = await createProject(name, path);
    loadTree(proj.path);
  }, [createProject, loadTree]);

  const cwd = activeProject?.path ?? '';

  if (cliStatus && !cliStatus.installed) {
    return <SetupWizard cliStatus={cliStatus} onRetry={checkCli} />;
  }

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Title bar */}
      <div
        className="flex items-center justify-between border-b px-4 py-2.5 text-sm"
        style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md text-xs font-bold"
            style={{ backgroundImage: 'var(--gradient-accent)', color: '#04121a' }}>◆</span>
          <span className="bg-clip-text font-semibold tracking-tight"
            style={{ backgroundImage: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            JustNeedThink
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="jnt-btn-ghost px-2.5 py-1 text-xs"
          >
            {rightPanelOpen ? 'Hide Panel' : 'Show Panel'}
          </button>
          <span className="jnt-chip px-2 py-0.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {cliStatus?.version ? `CLI ${cliStatus.version}` : 'v0.2.0'}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: projects + sessions */}
        <aside className="flex w-[240px] flex-col border-r" style={{ borderColor: 'var(--color-border)' }}>
          <ProjectList
            projects={projects}
            activeId={activeProjectId}
            onSelect={handleProjectSelect}
            onDelete={handleProjectDelete}
            onNew={() => setShowNewProject(true)}
          />
          {activeProject && (
            <SessionList
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
              onNew={handleNewSession}
            />
          )}
        </aside>

        {/* Chat — min-w-0 so the center column is sized by the preset layout
            (left 240 + right 300 + remaining), not stretched by long content. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ChatPanel tabId={activeSessionId} cwd={cwd} />
        </main>

        {/* Right panel: files */}
        {rightPanelOpen && (
          <aside className="flex w-[300px] flex-col border-l" style={{ borderColor: 'var(--color-border)' }}>
            {/* Tab selector */}
            <div className="flex items-center gap-1 border-b p-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }}>
              {(['files', 'agents', 'workflows', 'skills'] as const).map((tab) => {
                const active = rightTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className="flex-1 rounded-md py-1.5 text-center font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--color-surface)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(var(--color-accent-rgb),0.25)' : 'none',
                    }}
                  >{tab}</button>
                );
              })}
            </div>

            {rightTab === 'files' ? (
              <>
                <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <FileExplorer
                    tree={fileTree}
                    selectedPath={selectedFilePath}
                    onSelect={(p) => { selectFile(p); loadPreview(p); }}
                    onDelete={(p) => { deleteFile(p); }}
                    isLoading={fileTreeLoading}
                  />
                </div>
                <div className="flex h-[200px] flex-shrink-0 flex-col border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <FilePreview path={previewPath} content={previewContent} onSave={(p, c) => writeFile(p, c)} />
                </div>
              </>
            ) : rightTab === 'agents' ? (
              <div className="flex-1 overflow-hidden">
                <AgentPanel />
              </div>
            ) : rightTab === 'workflows' ? (
              <div className="flex-1 overflow-hidden">
                <WorkflowPanel />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <SkillsPanel />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between border-t px-3 py-1.5 text-xs"
        style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="jnt-dot h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: cliStatus?.installed ? 'var(--color-success)' : 'var(--color-warning)', color: cliStatus?.installed ? 'var(--color-success)' : 'var(--color-warning)' }} />
            {cliStatus?.installed ? 'CLI ready' : 'connecting'}
          </span>
          {activeProject && (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ opacity: 0.7 }}>❯</span>{activeProject.name}
            </span>
          )}
          <CreditIndicator summary={creditSummary} />
        </span>
        <span className="tracking-wide">v0.2.0</span>
      </div>

      {/* Project create dialog */}
      {showNewProject && (
        <ProjectCreateDialog
          onClose={() => setShowNewProject(false)}
          onCreate={handleProjectCreate}
        />
      )}
      <CommandPalette />
    </div>
  );
}

// --- Root ---

// --- Proper Error Boundary using componentDidCatch ---

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null; resetKey: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Caught render error:', error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, resetKey: this.state.resetKey + 1 });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    // Must be h-full: this wrapper sits between #root (height:100%) and AppShell
    // (h-full). Without it the height chain breaks and AppShell grows with its
    // content, pushing the input/status bar below the window's lower edge.
    return <div className="h-full" key={this.state.resetKey}>{this.props.children}</div>;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}
