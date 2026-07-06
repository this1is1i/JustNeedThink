import { useEffect, useRef } from 'react';
import { bridge, onClaudeStream, onClaudeStderr, onSessionExit } from '../lib/tauri-bridge';
import { useChatStore, generateMessageId, type ChatMessage } from '../stores/chatStore';

/**
 * Core hook: handles NDJSON stream messages from Claude CLI.
 * Routes messages between foreground and background tabs.
 */
export function useStreamProcessor(tabId: string, stdinId: string | null) {
  const unlistenRef = useRef<Array<() => void>>([]);
  const addMessage = useChatStore((s) => s.addMessage);
  const updatePartialMessage = useChatStore((s) => s.updatePartialMessage);
  const updatePartialThinking = useChatStore((s) => s.updatePartialThinking);
  const clearPartial = useChatStore((s) => s.clearPartial);
  const setSessionStatus = useChatStore((s) => s.setSessionStatus);
  const setActivityStatus = useChatStore((s) => s.setActivityStatus);
  const setSessionMeta = useChatStore((s) => s.setSessionMeta);

  useEffect(() => {
    if (!stdinId) return;

    const cleanups: Array<() => void> = [];

    // Main stream listener
    onClaudeStream(stdinId, (message) => {
      handleStreamMessage(
        message,
        tabId,
        { addMessage, updatePartialMessage, updatePartialThinking, clearPartial, setSessionStatus, setActivityStatus, setSessionMeta },
      );
    }).then((unlisten) => cleanups.push(unlisten));

    // Stderr listener
    onClaudeStderr(stdinId, (line) => {
      console.warn(`[stderr:${stdinId}]`, line);
    }).then((unlisten) => cleanups.push(unlisten));

    // Exit listener
    onSessionExit(stdinId, (code) => {
      console.log(`[exit:${stdinId}] code=${code}`);
      setSessionStatus(tabId, code === 0 ? 'completed' : 'error');
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
      // Session result (summary)
      handlers.setSessionStatus(tabId, 'completed');
      break;

    case 'error':
      handlers.setSessionStatus(tabId, 'error');
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
        const text = block.text as string | undefined;
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
        handlers.addMessage(tabId, {
          id: generateMessageId(),
          role: 'system',
          type: 'tool_result',
          content: block.content as string || '',
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
