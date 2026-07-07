import { useEffect, useRef, useCallback } from 'react';
import { useCommandStore, type PaletteCommand } from '../../stores/commandStore';

export function CommandPalette() {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = useCommandStore((s) => s.isOpen);
  const query = useCommandStore((s) => s.query);
  const selectedIndex = useCommandStore((s) => s.selectedIndex);
  const close = useCommandStore((s) => s.close);
  const setQuery = useCommandStore((s) => s.setQuery);
  const setSelectedIndex = useCommandStore((s) => s.setSelectedIndex);
  const getFiltered = useCommandStore((s) => s.getFiltered);
  const fetchCommands = useCommandStore((s) => s.fetchCommands);

  const commands = getFiltered();

  // Fetch on first open
  useEffect(() => {
    if (isOpen) {
      fetchCommands();
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen, fetchCommands]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(Math.min(selectedIndex + 1, commands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (commands[selectedIndex]) {
            executeCommand(commands[selectedIndex]);
          }
          break;
        case 'Escape':
          close();
          break;
      }
    },
    [selectedIndex, commands, close, setSelectedIndex],
  );

  // Global Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const store = useCommandStore.getState();
        store.isOpen ? store.close() : store.open();
      }
      if (e.key === 'Escape' && useCommandStore.getState().isOpen) {
        useCommandStore.getState().close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="jnt-backdrop fixed inset-0 z-50 flex items-start justify-center pt-[15%]"
      onClick={close}
    >
      <div
        className="jnt-card jnt-gradient-border jnt-animate-in w-full max-w-lg overflow-hidden"
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-accent)' }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text)' }}
          />
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {commands.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No commands found
            </div>
          ) : (
            commands.map((cmd, i) => (
              <button
                key={cmd.id}
                className="mx-1.5 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                style={{
                  width: 'calc(100% - 0.75rem)',
                  backgroundColor: i === selectedIndex ? 'var(--color-surface-hover)' : 'transparent',
                  boxShadow: i === selectedIndex ? 'inset 0 0 0 1px rgba(var(--color-accent-rgb),0.25)' : 'none',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => executeCommand(cmd)}
              >
                <span
                  className="jnt-chip px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {cmd.category}
                </span>
                <span style={{ color: 'var(--color-text)' }}>{cmd.name}</span>
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {cmd.description}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 border-t px-4 py-2 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Execute</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

function executeCommand(cmd: PaletteCommand) {
  useCommandStore.getState().close();
  // Phase 5.1: dispatch to the appropriate handler
  console.log('Execute:', cmd.id);
}
