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
      <div className="w-full">
        <details className="w-full rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <summary className="cursor-pointer px-4 py-2 font-medium"
            style={{ color: 'var(--color-info)' }}>
            {message.toolName || 'Tool'}
          </summary>
          {inputStr && (
            <pre className="max-h-[240px] overflow-auto border-t px-4 py-3 text-xs whitespace-pre-wrap"
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
      <div className="w-full">
        <details className="w-full rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <summary className="cursor-pointer px-4 py-2 font-medium"
            style={{ color: 'var(--color-success)' }}>
            Tool result
          </summary>
          <pre className="max-h-[240px] overflow-auto border-t px-4 py-3 text-xs whitespace-pre-wrap"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {truncate(message.content, 4000)}
          </pre>
        </details>
      </div>
    );
  }

  // Text / partial: markdown rendered
  if (!isUser) {
    return (
      <article className="jnt-animate-in w-full">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase"
          style={{ color: 'var(--color-text-muted)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
          Codex
        </div>
        <div className="jnt-prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || '...'}
          </ReactMarkdown>
        </div>
      </article>
    );
  }

  return (
    <div className="jnt-animate-in flex w-full justify-end">
      <div
        className={`max-w-[78%] rounded-xl px-4 py-3 text-base leading-relaxed ${message.isPartial ? 'opacity-95' : ''}`}
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="jnt-prose max-w-none" style={{ fontSize: '0.98rem' }}>
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
    <div className="w-full">
      <div className="w-full rounded-lg border p-4 text-sm"
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
