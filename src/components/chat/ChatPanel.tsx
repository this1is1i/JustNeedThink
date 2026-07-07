import { useRef, useEffect } from 'react';
import { useChatStore, type ActivityStatus } from '../../stores/chatStore';
import { useStreamProcessor, sendMessage } from '../../hooks/useStreamProcessor';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';

interface ChatPanelProps {
  tabId: string;
  cwd: string;
}

const IDLE_ACTIVITY: ActivityStatus = { phase: 'idle' };

export function ChatPanel({ tabId, cwd }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tab = useChatStore((s) => s.tabs.get(tabId));
  const messages = tab?.messages ?? [];
  const partialText = tab?.partialText ?? '';
  const partialThinking = tab?.partialThinking ?? '';
  const isStreaming = tab?.isStreaming ?? false;
  const activityStatus = tab?.activityStatus ?? IDLE_ACTIVITY;
  const stdinId = tab?.sessionMeta.stdinId ?? null;

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partialText, partialThinking]);

  // Stream processor
  useStreamProcessor(tabId, stdinId);

  const isRunning = tab?.sessionStatus === 'running' || isStreaming;

  const handleSubmit = async (prompt: string) => {
    const newStdinId = await sendMessage(tabId, prompt, {
      stdinId,
      cwd,
      permissionMode: 'default',
    });
    if (newStdinId && !stdinId) {
      useChatStore.getState().setSessionMeta(tabId, { stdinId: newStdinId });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Activity indicator */}
      {activityStatus.phase !== 'idle' && activityStatus.phase !== 'completed' && (
        <div
          className="flex-shrink-0 flex items-center gap-2 border-b px-4 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor:
              activityStatus.phase === 'thinking' ? 'var(--color-warning)'
              : activityStatus.phase === 'tool' ? 'var(--color-info)'
              : 'var(--color-success)'
            }}
          />
          {activityStatus.phase === 'thinking' && 'Thinking...'}
          {activityStatus.phase === 'writing' && 'Writing...'}
          {activityStatus.phase === 'tool' && `Running: ${activityStatus.toolName || 'tool'}`}
        </div>
      )}

      {/* Messages — only this area scrolls */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-2">
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}>
            Send a message to start
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming: partial thinking */}
        {partialThinking && (
          <div className="px-3 py-1">
            <details open className="text-xs">
              <summary style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                💭 Thinking...
              </summary>
              <pre className="mt-1 whitespace-pre-wrap rounded px-3 py-2 text-xs leading-relaxed"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                {partialThinking}
              </pre>
            </details>
          </div>
        )}

        {/* Streaming: partial text */}
        {partialText && (
          <MessageBubble message={{
            id: 'partial', role: 'assistant', type: 'text',
            content: partialText, isPartial: true, timestamp: Date.now(),
          }} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — fixed at bottom */}
      <div className="flex-shrink-0">
        <InputBar onSubmit={handleSubmit} isRunning={isRunning} />
      </div>
    </div>
  );
}
