import { useEffect, useRef } from 'react';
import { bridge, onClaudeStream, onClaudeStderr, onSessionExit } from '../lib/tauri-bridge';
import { useChatStore, generateMessageId, type ChatMessage } from '../stores/chatStore';
import { useCreditStore } from '../stores/creditStore';

/**
 * Core hook: handles NDJSON stream messages from Claude CLI.
 * Routes messages between foreground and background tabs.
 */
export function useStreamProcessor(tabId: string, stdinId: string | null) {
  const activeRef = useRef(true);
  const unlistenRef = useRef<Array<() => void>>([]);

  // Mark effect as inactive on cleanup — prevents stale callbacks
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [stdinId, tabId]);

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

    const cleanups: Array<() => void> = [];

    // Main stream listener — guarded by activeRef, wrapped in try-catch
    onClaudeStream(stdinId, (message: Record<string, unknown>) => {
      if (!activeRef.current) return;
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
    }).then((unlisten) => cleanups.push(unlisten));

    // Stderr listener
    onClaudeStderr(stdinId, (line: string) => {
      if (!activeRef.current) return;
      console.warn(`[stderr:${stdinId}]`, line);
    }).then((unlisten) => cleanups.push(unlisten));

    // Exit listener
    onSessionExit(stdinId, (code: number | null) => {
      if (!activeRef.current) return;
      handlersRef.current.setSessionStatus(tabId, code === 0 ? 'completed' : 'error');
    }).then((unlisten) => cleanups.push(unlisten));

    unlistenRef.current = cleanups;

    return () => {
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

    case 'user':
      // Echo of user message
      handlers.addMessage(tabId, {
        id: generateMessageId(),
        role: 'user',
        type: 'text',
        content: (message.message as { content?: string })?.content || '',
        isPartial: false,
        timestamp: Date.now(),
      });
      break;

    case 'assistant':
      // Assistant message — full or streaming
      handleAssistantMessage(message, tabId, handlers);
      break;

    case 'result':
      // Session result (summary) — track token usage
      {
        const usage = (message as Record<string, unknown>).usage as Record<string, number> | undefined;
        if (usage) {
          useCreditStore.getState().updateFromStream(
            usage.input_tokens || 0,
            usage.output_tokens || 0,
          );
        }
        handlers.setSessionStatus(tabId, 'completed');
      }
      break;

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
        const rawText = block.text;
        const text = typeof rawText === 'string' ? rawText
          : rawText ? String(rawText) : '';
        if (text) {
          handlers.updatePartialMessage(tabId, text);
        }
        break;
      }

      case 'thinking': {
        const thinking = block.thinking as string | undefined;
        if (thinking) {
          handlers.updatePartialThinking(tabId, thinking);
        }
        break;
      }

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

  // New session — start CLI process
  const newStdinId = `session_${tabId}_${Date.now()}`;
  const result = await bridge.startSession({
    prompt,
    cwd: options.cwd,
    model: options.model,
    session_id: newStdinId,
    thinking_level: options.thinkingLevel,
    permission_mode: options.permissionMode,
  });

  chatStore.setSessionMeta(tabId, {
    stdinId: newStdinId,
    sessionId: result.session_id,
  });

  return newStdinId;
}
