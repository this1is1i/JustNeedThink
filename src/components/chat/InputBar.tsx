import { useState, useCallback, type KeyboardEvent } from 'react';

interface InputBarProps {
  onSubmit: (message: string) => void;
  isRunning: boolean;
  placeholder?: string;
}

export function InputBar({ onSubmit, isRunning, placeholder }: InputBarProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

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
      <div
        className="flex items-end gap-2 rounded-xl border p-1.5 transition-shadow"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: focused ? 'transparent' : 'var(--color-border)',
          boxShadow: focused ? 'var(--glow-accent)' : 'none',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Type a message…  (Enter to send, Shift+Enter for new line)'}
          disabled={isRunning}
          rows={1}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          style={{ color: 'var(--color-text)', maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isRunning || !input.trim()}
          className="jnt-btn-accent flex-shrink-0 px-4 py-1.5 text-sm"
        >
          {isRunning ? '…' : 'Send'}
        </button>
      </div>
      <div
        className="mt-1.5 px-1 text-[11px]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
}
