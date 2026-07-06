import { useRef, useEffect } from 'react';
import { useChatStore, type ChatMessage, type ActivityStatus } from '../../stores/chatStore';
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

  const messages = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.messages ?? [];
  });

  const partialText = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.partialText ?? '';
  });

  const partialThinking = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.partialThinking ?? '';
  });

  const isStreaming = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.isStreaming ?? false;
  });

  const sessionStatus = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.sessionStatus ?? 'idle';
  });

  const activityStatus = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.activityStatus ?? IDLE_ACTIVITY;
  });

  const stdinId = useChatStore((s) => {
    const tab = s.tabs.get(tabId);
    return tab?.sessionMeta.stdinId ?? null;
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialText, partialThinking]);

  // Stream processor
  useStreamProcessor(tabId, stdinId);

  const handleSubmit = async (prompt: string) => {
    const newStdinId = await sendMessage(tabId, prompt, {
      stdinId,
      cwd,
      permissionMode: 'default',
    });

    if (newStdinId && !stdinId) {
      useChatStore.getState().setSessionMeta(tabId, {
        stdinId: newStdinId,
      });
    }
  };

  const isRunning = sessionStatus === 'running' || isStreaming;

  return (
    <div className="flex h-full flex-col">
      {/* Activity indicator */}
      {activityStatus.phase !== 'idle' && activityStatus.phase !== 'completed' && (
        <div
          className="flex items-center gap-2 border-b px-4 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                activityStatus.phase === 'thinking'
                  ? 'var(--color-warning)'
                  : activityStatus.phase === 'tool'
                    ? 'var(--color-info)'
                    : 'var(--color-success)',
            }}
          />
          {activityStatus.phase === 'thinking' && 'Thinking...'}
          {activityStatus.phase === 'writing' && 'Writing...'}
          {activityStatus.phase === 'tool' && `Running: ${activityStatus.toolName || 'tool'}`}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && !isStreaming && (
          <div
            className="flex h-full items-center justify-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Send a message to start
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Partial thinking */}
        {partialThinking && (
          <div className="px-4 py-1">
            <div
              className="max-w-[75%] rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-muted)',
              }}
            >
              💭 {partialThinking}
            </div>
          </div>
        )}

        {/* Partial text (streaming) */}
        {partialText && (
          <MessageBubble
            message={{
              id: 'partial',
              role: 'assistant',
              type: 'text',
              content: partialText,
              isPartial: true,
              timestamp: Date.now(),
            }}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputBar
        onSubmit={handleSubmit}
        isRunning={isRunning}
      />
    </div>
  );
}
