import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

interface InputBarProps {
  onSubmit: (message: string) => void;
  isRunning: boolean;
  placeholder?: string;
}

export function InputBar({ onSubmit, isRunning, placeholder }: InputBarProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
    setInput('');
  }, [input, isRunning, onSubmit]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

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
      className="border-t px-6 py-4"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div
        className="mx-auto flex max-w-[900px] items-end gap-3 rounded-xl border px-3 py-2.5 transition-shadow"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: focused ? 'transparent' : 'var(--color-border)',
          boxShadow: focused ? 'var(--glow-accent)' : 'none',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Ask Codex to inspect, change, or explain this project'}
          disabled={isRunning}
          rows={1}
          className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-3 text-base leading-relaxed outline-none"
          style={{ color: 'var(--color-text)', maxHeight: '180px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={isRunning || !input.trim()}
          title="Send"
          className="jnt-btn-accent flex h-10 w-10 flex-shrink-0 items-center justify-center text-lg"
        >
          {isRunning ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}
