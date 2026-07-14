import { useEffect, useRef } from 'react';
import { bridge, onClaudePermission, onClaudeStream, onClaudeStderr, onSessionExit } from '../lib/tauri-bridge';
import { useChatStore, generateMessageId, type ChatMessage } from '../stores/chatStore';
import { useCreditStore } from '../stores/creditStore';

/**
 * Core hook: handles NDJSON stream messages from Claude CLI.
 * Routes messages between foreground and background tabs.
 */
export function useStreamProcessor(tabId: string, stdinId: string | null) {
  // Stable store ref for callbacks that are registered once but called many times
  const handlersRef = useRef({
    addMessage: useChatStore.getState().addMessage,
    updatePartialMessage: useChatStore.getState().updatePartialMessage,
    updatePartialThinking: useChatStore.getState().updatePartialThinking,
    clearPartial: useChatStore.getState().clearPartial,
    setSessionStatus: useChatStore.getState().setSessionStatus,
    setActivityStatus: useChatStore.getState().setActivityStatus,
    setSessionMeta: useChatStore.getState().setSessionMeta,
  });

  useEffect(() => {
    if (!stdinId) return;

    // `listen` is asynchronous. Keep cancellation local to this particular
    // effect so a late listener cannot become active after a tab switch.
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const register = (listener: Promise<() => void>) => {
      void listener.then((unlisten) => {
        if (cancelled) unlisten();
        else cleanups.push(unlisten);
      }).catch((err) => console.error('[stream] Failed to register listener:', err));
    };

    register(onClaudeStream(stdinId, (message: Record<string, unknown>) => {
      if (cancelled) return;
      try {
        const h = handlersRef.current;
        handleStreamMessage(message, tabId, {
          addMessage: h.addMessage,
          updatePartialMessage: h.updatePartialMessage,
          updatePartialThinking: h.updatePartialThinking,
          clearPartial: h.clearPartial,
          setSessionStatus: h.setSessionStatus,
          setActivityStatus: h.setActivityStatus,
          setSessionMeta: h.setSessionMeta,
        });
      } catch (err) {
        console.error('[stream] Message handler error:', err);
      }
    }));

    register(onClaudeStderr(stdinId, (line: string) => {
      if (cancelled) return;
      console.warn(`[stderr:${stdinId}]`, line);
      handlersRef.current.addMessage(tabId, {
        id: generateMessageId(),
        role: 'system',
        type: 'tool_result',
        content: `CLI error: ${line}`,
        isPartial: false,
        timestamp: Date.now(),
      });
    }));

    register(onSessionExit(stdinId, (code: number | null) => {
      if (cancelled) return;
      const tab = useChatStore.getState().tabs.get(tabId);
      const sessionId = tab?.sessionMeta.sessionId;
      handlersRef.current.setSessionStatus(tabId, code === 0 ? 'completed' : 'error');
      handlersRef.current.setSessionMeta(tabId, {
        stdinId: undefined,
        resumeSessionId: sessionId,
      });
    }));

    register(onClaudePermission(stdinId, (request) => {
      if (cancelled) return;
      handlersRef.current.addMessage(tabId, {
        id: `permission_${request.requestId}`,
        role: 'system',
        type: 'permission',
        content: `Permission required for ${request.toolName}`,
        toolName: request.toolName,
        toolInput: request.input,
        permissionId: request.requestId,
        isPartial: false,
        timestamp: Date.now(),
      });
      handlersRef.current.setActivityStatus(tabId, { phase: 'awaiting', toolName: request.toolName });
    }));

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [stdinId, tabId]);
}

interface StreamHandlers {
  addMessage: (tabId: string, msg: ChatMessage) => void;
  updatePartialMessage: (tabId: string, text: string) => void;
  updatePartialThinking: (tabId: string, text: string) => void;
  clearPartial: (tabId: string) => void;
  setSessionStatus: (tabId: string, status: import('../stores/chatStore').SessionStatus) => void;
  setActivityStatus: (tabId: string, status: import('../stores/chatStore').ActivityStatus) => void;
  setSessionMeta: (tabId: string, meta: Partial<import('../stores/chatStore').SessionMeta>) => void;
}

function handleStreamMessage(
  message: Record<string, unknown>,
  tabId: string,
  handlers: StreamHandlers,
) {
  const type = message.type as string | undefined;

  switch (type) {
    case 'system':
      // System initialization message
      if (message.session_id) {
        handlers.setSessionMeta(tabId, {
          sessionId: message.session_id as string,
        });
      }
      break;

    case 'stream_event':
      // Incremental streaming deltas (--include-partial-messages).
      handleStreamEvent(message, tabId, handlers);
      break;

    case 'user':
      // The prompt was inserted optimistically by sendMessage. The CLI echoes
      // it over stream-json, so rendering it again would duplicate every turn.
      break;

    case 'assistant':
      // Assistant message — full or streaming
      handleAssistantMessage(message, tabId, handlers);
      break;

    case 'result':
      // Surface CLI failures rather than leaving the preceding tool card as
      // the last visible item, which looks like a hung tool invocation.
      if (message.is_error === true) {
        const detail = typeof message.result === 'string'
          ? message.result
          : typeof message.error === 'string' ? message.error : 'Claude CLI ended with an error';
        handlers.addMessage(tabId, {
          id: generateMessageId(),
          role: 'system',
          type: 'tool_result',
          content: `CLI error: ${detail}`,
          isPartial: false,
          timestamp: Date.now(),
        });
        handlers.setSessionStatus(tabId, 'error');
        break;
      }
      // End of turn — clear any live partial and mark complete.
      handlers.clearPartial(tabId);
      handlers.setSessionStatus(tabId, 'completed');
      break;

    default:
      break;
  }
}

/**
 * Handle a `stream_event` line: the raw Anthropic SSE events surfaced by
 * `--include-partial-messages`. This is where true incremental streaming
 * happens — we append only the delta, never the accumulated text.
 */
function handleStreamEvent(
  message: Record<string, unknown>,
  tabId: string,
  handlers: StreamHandlers,
) {
  const event = message.event as Record<string, unknown> | undefined;
  if (!event) return;

  switch (event.type as string | undefined) {
    case 'content_block_delta': {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!delta) return;
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        handlers.updatePartialMessage(tabId, delta.text);
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        handlers.updatePartialThinking(tabId, delta.thinking);
      }
      break;
    }
    case 'message_delta': {
      // Authoritative token usage lives here, not on the `result` line.
      const usage = event.usage as Record<string, number> | undefined;
      if (usage) {
        useCreditStore.getState().updateFromStream(
          usage.input_tokens || 0,
          usage.output_tokens || 0,
        );
      }
      break;
    }
    default:
      break;
  }
}

function handleAssistantMessage(
  message: Record<string, unknown>,
  tabId: string,
  handlers: StreamHandlers,
) {
  const msg = message.message as Record<string, unknown> | undefined;
  if (!msg) return;

  const content = msg.content as Array<Record<string, unknown>> | undefined;
  if (!content) return;

  for (const block of content) {
    const blockType = block.type as string;

    switch (blockType) {
      case 'text': {
        // The full assistant message is authoritative. The live partial
        // already showed this text via stream_event deltas — replace it with
        // a permanent message rather than appending (which would duplicate).
        const rawText = block.text;
        const text = typeof rawText === 'string' ? rawText
          : rawText ? String(rawText) : '';
        if (text) {
          handlers.clearPartial(tabId);
          handlers.addMessage(tabId, {
            id: generateMessageId(),
            role: 'assistant',
            type: 'text',
            content: text,
            isPartial: false,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'thinking':
        // Thinking is shown live via the partial preview; no permanent record.
        break;

      case 'tool_use': {
        // Flush partial text before tool use
        handlers.clearPartial(tabId);

        handlers.addMessage(tabId, {
          id: block.id as string || generateMessageId(),
          role: 'assistant',
          type: 'tool_use',
          content: `Using tool: ${block.name || 'unknown'}`,
          toolName: block.name as string,
          toolInput: block.input,
          isPartial: false,
          timestamp: Date.now(),
        });

        handlers.setActivityStatus(tabId, {
          phase: 'tool',
          toolName: block.name as string,
        });
        break;
      }

      case 'tool_result': {
        // content can be string or object — normalize for React rendering
        const rawContent = block.content;
        const safeContent: string =
          typeof rawContent === 'string' ? rawContent
          : rawContent && typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2)
          : String(rawContent ?? '');

        handlers.addMessage(tabId, {
          id: generateMessageId(),
          role: 'system',
          type: 'tool_result',
          content: safeContent,
          toolName: block.tool_use_id
            ? `result:${block.tool_use_id}`
            : undefined,
          isPartial: false,
          timestamp: Date.now(),
        });

        handlers.setActivityStatus(tabId, { phase: 'writing' });
        break;
      }

      default:
        break;
    }
  }

  // Handle stop_reason
  if (msg.stop_reason === 'end_turn') {
    handlers.clearPartial(tabId);
    handlers.setActivityStatus(tabId, { phase: 'completed' });
  }
}

/**
 * Send a message to the CLI: starts a new session if needed, or sends via stdin.
 */
export async function sendMessage(
  tabId: string,
  prompt: string,
  options: {
    stdinId?: string | null;
    cwd: string;
    sessionId?: string;
    resumeSessionId?: string;
    model?: string;
    thinkingLevel?: string;
    permissionMode?: string;
  },
): Promise<string | null> {
  const chatStore = useChatStore.getState();

  // Add user message to chat
  chatStore.addMessage(tabId, {
    id: generateMessageId(),
    role: 'user',
    type: 'text',
    content: prompt,
    isPartial: false,
    timestamp: Date.now(),
  });

  chatStore.setSessionStatus(tabId, 'running');
  chatStore.setActivityStatus(tabId, { phase: 'thinking' });

  if (options.stdinId) {
    // Existing session — send via stdin
    await bridge.sendStdin(options.stdinId, prompt);
    return options.stdinId;
  }

  // New runtime process. For brand-new chats this can also become the CLI
  // transcript id; for resumed chats it must be distinct from the historical
  // transcript id because the CLI rejects `--session-id` for an existing file.
  const newStdinId = options.resumeSessionId
    ? crypto.randomUUID()
    : options.sessionId ?? crypto.randomUUID();
  const result = await bridge.startSession({
    prompt,
    cwd: options.cwd,
    model: options.model,
    session_id: newStdinId,
    resume_session_id: options.resumeSessionId,
    thinking_level: options.thinkingLevel,
    permission_mode: options.permissionMode,
  });

  chatStore.setSessionMeta(tabId, {
    stdinId: newStdinId,
    sessionId: result.session_id,
    resumeSessionId: undefined,
  });

  return newStdinId;
}
