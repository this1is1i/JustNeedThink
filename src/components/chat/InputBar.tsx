import { useState, useCallback, type KeyboardEvent } from 'react';

interface InputBarProps {
  onSubmit: (message: string) => void;
  isRunning: boolean;
  placeholder?: string;
}

export function InputBar({ onSubmit, isRunning, placeholder }: InputBarProps) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
    setInput('');
  }, [input, isRunning, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      className="border-t px-4 py-3"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message... (Enter to send, Shift+Enter for new line)'}
          disabled={isRunning}
          rows={1}
          className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            maxHeight: '120px',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isRunning || !input.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
          style={{
            backgroundColor: isRunning || !input.trim()
              ? 'var(--color-surface)'
              : 'var(--color-accent)',
            color: isRunning || !input.trim()
              ? 'var(--color-text-muted)'
              : 'var(--color-bg)',
            cursor: isRunning || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isRunning ? '...' : 'Send'}
        </button>
      </div>
      <div
        className="mt-1 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
}
