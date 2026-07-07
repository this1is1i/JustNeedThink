import { useState, useCallback, useEffect, Component } from 'react';
import { useChatStore } from './stores/chatStore';
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
      <div className="max-w-md rounded-lg p-6 text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-error)' }}>Something went wrong</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error.message}</p>
        <button onClick={onReset} className="rounded px-4 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>Reload</button>
      </div>
    </div>
  );
}

// --- Setup Wizard ---

function SetupWizard({ cliStatus, onRetry }: { cliStatus: CliStatus; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-md rounded-lg p-8 text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Setup Required</h2>
        <div className="mb-4 space-y-2 text-left text-sm">
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
        <button onClick={onRetry} className="rounded px-6 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>Retry Detection</button>
      </div>
    </div>
  );
}

// --- Session List (per project) ---

interface SessionInfo {
  id: string;
  name: string;
  status: string;
}

function SessionList({ sessions, activeId, onSelect, onNew }: {
  sessions: SessionInfo[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>SESSIONS</span>
        <button onClick={onNew} className="rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>+</button>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full border-b px-3 py-1.5 text-left text-sm transition-colors"
            style={{
              backgroundColor: s.id === activeId ? 'var(--color-surface)' : 'transparent',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="truncate text-xs" style={{ color: s.id === activeId ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
              {s.name}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              {s.status === 'running' ? '⚡ Running' : s.status === 'completed' ? '✓ Done' : '○ Idle'}
            </div>
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
  const sessionMeta = useChatStore((s) => s.tabs.get(activeSessionId)?.sessionMeta);

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
  const [sessions, setSessions] = useState<SessionInfo[]>([
    { id: 'main', name: 'Main Session', status: 'idle' },
  ]);

  // Init
  const checkCli = useCallback(async () => {
    try { setCliStatus(await bridge.checkClaudeCli()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { checkCli(); fetchCreditSummary(); }, [checkCli, fetchCreditSummary]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { ensureTab(activeSessionId); }, [ensureTab, activeSessionId]);

  // Load file tree for active project
  useEffect(() => {
    if (activeProject) {
      loadTree(activeProject.path);
    }
  }, [activeProject, loadTree]);

  // Session status sync
  useEffect(() => {
    if (!sessionMeta) return;
    const tab = useChatStore.getState().tabs.get(activeSessionId);
    if (!tab) return;
    const status = tab.sessionStatus === 'running' || tab.isStreaming
      ? 'running' : tab.sessionStatus === 'completed' ? 'completed' : 'idle';
    setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, status } : s));
  }, [sessionMeta, activeSessionId]);

  const handleNewSession = useCallback(() => {
    const id = `session_${Date.now()}`;
    setSessions((prev) => [...prev, { id, name: `Session ${prev.length}`, status: 'idle' }]);
    ensureTab(id);
    setActiveSessionId(id);
  }, [ensureTab]);

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
        className="flex items-center justify-between border-b px-4 py-2 text-sm"
        style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
        data-tauri-drag-region
      >
        <span className="font-medium" style={{ color: 'var(--color-text)' }}>JustNeedThink</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="rounded px-2 py-0.5 text-xs"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
          >
            {rightPanelOpen ? 'Hide Panel' : 'Show Panel'}
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
              onSelect={(id) => { setActiveSessionId(id); ensureTab(id); }}
              onNew={handleNewSession}
            />
          )}
        </aside>

        {/* Chat */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <ChatPanel tabId={activeSessionId} cwd={cwd} />
        </main>

        {/* Right panel: files */}
        {rightPanelOpen && (
          <aside className="flex w-[300px] flex-col border-l" style={{ borderColor: 'var(--color-border)' }}>
            {/* Tab selector */}
            <div className="flex border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setRightTab('files')}
                className="flex-1 py-1.5 text-center"
                style={{
                  backgroundColor: rightTab === 'files' ? 'var(--color-surface)' : 'transparent',
                  color: rightTab === 'files' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: rightTab === 'files' ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >Files</button>
              <button
                onClick={() => setRightTab('agents')}
                className="flex-1 py-1.5 text-center"
                style={{
                  backgroundColor: rightTab === 'agents' ? 'var(--color-surface)' : 'transparent',
                  color: rightTab === 'agents' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: rightTab === 'agents' ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >Agents</button>
              <button
                onClick={() => setRightTab('workflows')}
                className="flex-1 py-1.5 text-center"
                style={{
                  backgroundColor: rightTab === 'workflows' ? 'var(--color-surface)' : 'transparent',
                  color: rightTab === 'workflows' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: rightTab === 'workflows' ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >Workflows</button>
              <button
                onClick={() => setRightTab('skills')}
                className="flex-1 py-1.5 text-center"
                style={{
                  backgroundColor: rightTab === 'skills' ? 'var(--color-surface)' : 'transparent',
                  color: rightTab === 'skills' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: rightTab === 'skills' ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
              >Skills</button>
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
        className="flex items-center justify-between border-t px-3 py-1 text-xs"
        style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <span className="flex items-center gap-3">
          <span>{cliStatus?.installed ? '✅' : '⏳'}</span>
          {activeProject && <span>📁 {activeProject.name}</span>}
          <CreditIndicator summary={creditSummary} />
        </span>
        <span>v0.2.0</span>
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
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}
