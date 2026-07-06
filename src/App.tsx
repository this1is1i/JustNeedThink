import { useState, useCallback } from 'react';

interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div
      className="flex h-full items-center justify-center p-8"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="max-w-md rounded-lg p-6 text-center"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
          Something went wrong
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {error.message}
        </p>
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

function AppShell() {
  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2 text-sm"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderBottom: '1px solid var(--color-border)',
        }}
        data-tauri-drag-region
      >
        <span className="font-medium" style={{ color: 'var(--color-text)' }}>
          JustNeedThink
        </span>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex w-[280px] flex-col border-r"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex-1 p-4">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Sessions
            </p>
          </div>
        </aside>

        {/* Chat area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h1
                className="mb-2 text-2xl font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                JustNeedThink
              </h1>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Claude Code GUI — Phase 0 Scaffold
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Ready</span>
        <span>v0.1.0</span>
      </div>
    </div>
  );
}

function ErrorBoundaryInner({ children, onError }: {
  children: React.ReactNode;
  onError: (error: Error) => void;
}) {
  try {
    return <>{children}</>;
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

export default function App() {
  const [error, setError] = useState<Error | null>(null);

  const handleReset = useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    return <ErrorFallback error={error} onReset={handleReset} />;
  }

  return (
    <ErrorBoundaryInner onError={setError}>
      <AppShell />
    </ErrorBoundaryInner>
  );
}
