import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../stores/chatStore';

interface MessageBubbleProps {
  message: ChatMessage;
}

/** Truncate long strings for display */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

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
    <div className={`flex w-full px-4 py-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${message.isPartial ? 'opacity-90' : ''}`}
        style={{
          backgroundColor: isUser ? 'var(--color-accent)' : 'var(--color-surface)',
          color: isUser ? 'var(--color-bg)' : 'var(--color-text)',
        }}
      >
        <div className="prose prose-sm max-w-none"
          style={{
            '--tw-prose-body': isUser ? 'var(--color-bg)' : 'var(--color-text)',
            '--tw-prose-headings': isUser ? 'var(--color-bg)' : 'var(--color-text)',
            '--tw-prose-code': isUser ? 'var(--color-bg)' : 'var(--color-accent)',
            '--tw-prose-pre-bg': isUser ? 'rgba(0,0,0,0.2)' : 'var(--color-bg-tertiary)',
            '--tw-prose-pre-code': isUser ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          } as React.CSSProperties}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || '...'}
          </ReactMarkdown>
        </div>
        {message.isPartial && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-full align-middle"
            style={{ backgroundColor: 'var(--color-text-secondary)' }} />
        )}
      </div>
    </div>
  );
}
