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
  const sessionId = tab?.sessionMeta.sessionId;
  const resumeSessionId = tab?.sessionMeta.resumeSessionId;

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, partialText, partialThinking]);

  // Stream processor
  useStreamProcessor(tabId, stdinId);

  const isRunning = tab?.sessionStatus === 'running' || isStreaming;

  const handleSubmit = async (prompt: string) => {
    try {
      const newStdinId = await sendMessage(tabId, prompt, {
        stdinId,
        cwd,
        sessionId,
        resumeSessionId,
        // The desktop app has no implementation for Claude's stdio permission
        // callback protocol. `acceptEdits` lets normal project file edits run
        // while preserving the CLI's safeguards for more sensitive tools.
        permissionMode: 'acceptEdits',
      });
      if (newStdinId && !stdinId) {
        useChatStore.getState().setSessionMeta(tabId, { stdinId: newStdinId });
      }
    } catch (err) {
      const store = useChatStore.getState();
      store.setSessionStatus(tabId, 'error');
      store.addMessage(tabId, {
        id: `err_${Date.now()}`,
        role: 'system',
        type: 'tool_result',
        content: `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
        isPartial: false,
        timestamp: Date.now(),
      });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Activity indicator */}
      {activityStatus.phase !== 'idle' && activityStatus.phase !== 'completed' && (
        <div
          className="flex-shrink-0 flex items-center gap-2 border-b px-6 py-2 text-sm"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span className="jnt-pulse inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor:
              activityStatus.phase === 'thinking' ? 'var(--color-warning)'
              : activityStatus.phase === 'tool' ? 'var(--color-info)'
              : 'var(--color-accent)'
            }}
          />
          {activityStatus.phase === 'thinking' && 'Thinking'}
          {activityStatus.phase === 'writing' && 'Writing'}
          {activityStatus.phase === 'tool' && `Running ${activityStatus.toolName || 'tool'}`}
        </div>
      )}

      {/* Messages — only this area scrolls */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="jnt-pulse flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ backgroundImage: 'var(--gradient-accent)', color: '#04121a' }}>◆</div>
            <div className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Ready
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming: partial thinking */}
          {partialThinking && (
            <details open className="rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
              <summary style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Thinking
              </summary>
              <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}>
                {partialThinking}
              </pre>
            </details>
          )}

          {/* Streaming: partial text — kept plain until the message finalizes. */}
          {partialText && (
            <div className="jnt-animate-in w-full">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-muted)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
                Codex
              </div>
              <div
                className="whitespace-pre-wrap break-words text-base leading-7"
                style={{ color: 'var(--color-text)' }}
              >
              {partialText}
              <span className="jnt-caret ml-0.5 inline-block h-3.5 w-[3px] rounded-full align-middle"
                style={{ backgroundColor: 'var(--color-accent)' }} />
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input — fixed at bottom */}
      <div className="flex-shrink-0">
        <InputBar onSubmit={handleSubmit} isRunning={isRunning} />
      </div>
    </div>
  );
}
