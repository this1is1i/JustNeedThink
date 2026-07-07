import { useState, useCallback, useEffect } from 'react';
import { useChatStore } from './stores/chatStore';
import { useFileStore } from './stores/fileStore';
import { bridge, type CliStatus } from './lib/tauri-bridge';
import { ChatPanel } from './components/chat/ChatPanel';
import { FileExplorer } from './components/files/FileExplorer';
import { FilePreview } from './components/files/FilePreview';

// --- Error Boundary ---

interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex h-full items-center justify-center p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-md rounded-lg p-6 text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
          Something went wrong
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error.message}</p>
        <button
          onClick={onReset}
          className="rounded px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

// --- Session Sidebar ---

interface SessionInfo {
  id: string;
  name: string;
  status: string;
}

const DEFAULT_SESSION: SessionInfo = { id: 'main', name: 'Main Session', status: 'idle' };

function SessionSidebar({ sessions, activeId, onSelect, onNew }: {
  sessions: SessionInfo[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>SESSIONS</span>
        <button
          onClick={onNew}
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full border-b px-3 py-2 text-left text-sm transition-colors"
            style={{
              backgroundColor: s.id === activeId ? 'var(--color-surface)' : 'transparent',
              borderColor: 'var(--color-border)',
              color: s.id === activeId ? 'var(--color-text)' : 'var(--color-text-secondary)',
            }}
          >
            <div className="truncate">{s.name}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {s.status === 'running' ? '⚡ Running' : s.status === 'completed' ? '✓ Done' : '○ Idle'}
            </div>
          </button>
        ))}
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
              Claude CLI {cliStatus.installed ? `found (${cliStatus.version || 'unknown version'})` : 'not found'}
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
        <button
          onClick={onRetry}
          className="rounded px-6 py-2 text-sm font-medium"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Retry Detection
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

const DEFAULT_CWD = 'D:\\AAWorkSpeace\\liteplay';

function AppShell() {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([DEFAULT_SESSION]);
  const [activeSession, setActiveSession] = useState<string>('main');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const ensureTab = useChatStore((s) => s.ensureTab);
  const sessionMeta = useChatStore((s) => s.tabs.get(activeSession)?.sessionMeta);

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

  // Check CLI on startup
  const checkCli = useCallback(async () => {
    try {
      const status = await bridge.checkClaudeCli();
      setCliStatus(status);
    } catch (err) {
      console.error('Failed to check CLI:', err);
    }
  }, []);

  useEffect(() => { checkCli(); }, [checkCli]);

  // Load file tree
  useEffect(() => { loadTree(DEFAULT_CWD); }, [loadTree]);

  const handleNewSession = useCallback(() => {
    const id = `session_${Date.now()}`;
    setSessions((prev) => [...prev, { id, name: `Session ${prev.length}`, status: 'idle' }]);
    setActiveSession(id);
    ensureTab(id);
  }, [ensureTab]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSession(id);
    ensureTab(id);
  }, [ensureTab]);

  const handleFileSelect = useCallback((path: string) => {
    selectFile(path);
    loadPreview(path);
  }, [selectFile, loadPreview]);

  const handleFileDelete = useCallback(async (path: string) => {
    await deleteFile(path);
  }, [deleteFile]);

  const handleFileSave = useCallback(async (path: string, content: string) => {
    await writeFile(path, content);
  }, [writeFile]);

  useEffect(() => { ensureTab('main'); }, [ensureTab]);

  // Update session status in sidebar
  useEffect(() => {
    if (!sessionMeta) return;
    const tab = useChatStore.getState().tabs.get(activeSession);
    if (!tab) return;
    const status = tab.sessionStatus === 'running' || tab.isStreaming
      ? 'running' : tab.sessionStatus === 'completed' ? 'completed' : 'idle';
    setSessions((prev) => prev.map((s) => s.id === activeSession ? { ...s, status } : s));
  }, [sessionMeta, activeSession]);

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
            className="rounded px-2 py-0.5 text-xs transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
          >
            {rightPanelOpen ? 'Hide Files' : 'Show Files'}
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {cliStatus?.version ? `CLI ${cliStatus.version}` : 'v0.1.0'}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[220px] flex-col border-r" style={{ borderColor: 'var(--color-border)' }}>
          <SessionSidebar sessions={sessions} activeId={activeSession} onSelect={handleSelectSession} onNew={handleNewSession} />
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <ChatPanel tabId={activeSession} cwd={DEFAULT_CWD} />
        </main>

        {rightPanelOpen && (
          <aside className="flex w-[300px] flex-col border-l" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <FileExplorer
                tree={fileTree}
                selectedPath={selectedFilePath}
                onSelect={handleFileSelect}
                onDelete={handleFileDelete}
                isLoading={fileTreeLoading}
              />
            </div>
            <div
              className="flex h-[40%] flex-col border-t"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <FilePreview
                path={previewPath}
                content={previewContent}
                onSave={handleFileSave}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between border-t px-3 py-1 text-xs"
        style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <span>
          {cliStatus?.installed ? '✅ CLI ready' : '⏳ Checking...'}
          {cliStatus?.git_bash_available ? ' · bash ready' : ''}
        </span>
        <span>JustNeedThink v0.1.0</span>
      </div>
    </div>
  );
}

// --- Root ---

export default function App() {
  const [error, setError] = useState<Error | null>(null);
  const key = useState(() => Date.now())[0];

  if (error) {
    return <ErrorFallback error={error} onReset={() => setError(null)} />;
  }

  try {
    return <AppShell key={key} />;
  } catch (err) {
    throw err;
  }
}
