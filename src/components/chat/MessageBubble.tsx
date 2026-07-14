import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../stores/chatStore';
import { bridge } from '../../lib/tauri-bridge';

interface MessageBubbleProps {
  message: ChatMessage;
}

/** Truncate long strings for display */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function MessageBubbleImpl({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (message.type === 'permission') {
    return <PermissionBubble message={message} />;
  }

  // Tool use: collapsible card
  if (message.type === 'tool_use') {
    const inputStr = message.toolInput
      ? JSON.stringify(message.toolInput, null, 2)
      : '';
    return (
      <div className="flex w-full justify-start px-4 py-1">
        <details className="w-full max-w-[85%] rounded-lg border text-xs"
          style={{ borderColor: 'var(--color-info)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <summary className="cursor-pointer px-3 py-1.5 font-medium"
            style={{ color: 'var(--color-info)' }}>
            🔧 {message.toolName || 'Tool'}
          </summary>
          {inputStr && (
            <pre className="max-h-[200px] overflow-auto border-t px-3 py-2 text-xs whitespace-pre-wrap"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              {truncate(inputStr, 2000)}
            </pre>
          )}
        </details>
      </div>
    );
  }

  // Tool result: compact display
  if (message.type === 'tool_result') {
    return (
      <div className="flex w-full justify-start px-4 py-1">
        <details className="w-full max-w-[85%] rounded-lg border text-xs"
          style={{ borderColor: 'var(--color-success)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <summary className="cursor-pointer px-3 py-1.5 font-medium"
            style={{ color: 'var(--color-success)' }}>
            ✅ Tool result
          </summary>
          <pre className="max-h-[200px] overflow-auto border-t px-3 py-2 text-xs whitespace-pre-wrap"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {truncate(message.content, 4000)}
          </pre>
        </details>
      </div>
    );
  }

  // Text / partial: markdown rendered
  return (
    <div className={`jnt-animate-in flex w-full px-4 py-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${message.isPartial ? 'opacity-95' : ''}`}
        style={{
          backgroundImage: isUser ? 'var(--gradient-accent)' : 'none',
          backgroundColor: isUser ? undefined : 'var(--color-surface)',
          color: isUser ? '#04121a' : 'var(--color-text)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          boxShadow: isUser ? 'var(--glow-accent)' : 'var(--shadow-sm)',
        }}
      >
        <div className="jnt-prose prose prose-sm max-w-none"
          style={{
            '--tw-prose-body': isUser ? '#04121a' : 'var(--color-text)',
            '--tw-prose-headings': isUser ? '#04121a' : 'var(--color-text)',
            '--tw-prose-bold': isUser ? '#04121a' : 'var(--color-text)',
            '--tw-prose-code': isUser ? '#04121a' : 'var(--color-accent)',
            '--tw-prose-pre-bg': isUser ? 'rgba(0,0,0,0.22)' : 'var(--color-bg-tertiary)',
            '--tw-prose-pre-code': isUser ? '#04121a' : 'var(--color-text-secondary)',
          } as React.CSSProperties}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || '...'}
          </ReactMarkdown>
        </div>
        {message.isPartial && (
          <span className="jnt-caret ml-0.5 inline-block h-3.5 w-[3px] rounded-full align-middle"
            style={{ backgroundColor: 'var(--color-accent)' }} />
        )}
      </div>
    </div>
  );
}

function PermissionBubble({ message }: MessageBubbleProps) {
  const [responding, setResponding] = useState(false);
  const [resolved, setResolved] = useState(false);
  const respond = async (allow: boolean) => {
    if (!message.permissionId || responding || resolved) return;
    setResponding(true);
    try {
      await bridge.respondPermission(message.permissionId, allow, allow ? undefined : 'Denied by user');
      setResolved(true);
    } finally {
      setResponding(false);
    }
  };
  const input = message.toolInput ? JSON.stringify(message.toolInput, null, 2) : '';
  return (
    <div className="flex w-full justify-start px-4 py-1.5">
      <div className="w-full max-w-[85%] rounded-lg border p-3 text-sm"
        style={{ borderColor: 'var(--color-warning)', backgroundColor: 'var(--color-bg-tertiary)' }}>
        <div className="font-medium" style={{ color: 'var(--color-warning)' }}>Permission required: {message.toolName}</div>
        {input && <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap text-xs" style={{ color: 'var(--color-text-secondary)' }}>{truncate(input, 2000)}</pre>}
        <div className="mt-3 flex gap-2">
          <button disabled={responding || resolved} onClick={() => void respond(true)} className="jnt-btn-accent px-3 py-1 text-xs">Allow</button>
          <button disabled={responding || resolved} onClick={() => void respond(false)} className="jnt-btn-ghost px-3 py-1 text-xs">Deny</button>
        </div>
      </div>
    </div>
  );
}

// Finalized message objects are referentially stable, so memo prevents every
// bubble from re-rendering (and re-parsing markdown) on each streaming token.
export const MessageBubble = memo(MessageBubbleImpl);
