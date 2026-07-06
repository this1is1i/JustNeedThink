import type { ChatMessage } from '../../stores/chatStore';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isPartial;

  return (
    <div
      className={`flex w-full gap-3 px-4 py-2 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2 ${
          isUser
            ? ''
            : ''
        }`}
        style={{
          backgroundColor: isUser
            ? 'var(--color-accent)'
            : 'var(--color-surface)',
          color: isUser ? 'var(--color-bg)' : 'var(--color-text)',
        }}
      >
        {message.type === 'tool_use' && (
          <div className="mb-1 text-xs font-medium" style={{ color: 'var(--color-info)' }}>
            🔧 {message.toolName}
          </div>
        )}
        {message.type === 'tool_result' && (
          <div className="mb-1 text-xs font-medium" style={{ color: 'var(--color-success)' }}>
            ✅ Tool result
          </div>
        )}
        {message.type === 'thinking' && (
          <div className="mb-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            💭 Thinking
          </div>
        )}
        <div className={`whitespace-pre-wrap text-sm ${isStreaming ? 'opacity-80' : ''}`}>
          {message.content || (
            <span style={{ color: 'var(--color-text-muted)' }}>...</span>
          )}
        </div>
        {isStreaming && (
          <span
            className="ml-1 inline-block h-3 w-1 animate-pulse rounded-full"
            style={{ backgroundColor: 'var(--color-text-secondary)' }}
          />
        )}
      </div>
    </div>
  );
}
