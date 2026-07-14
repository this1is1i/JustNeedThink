import { create } from 'zustand';

// --- Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'tool_use' | 'thinking' | 'tool_result' | 'permission';
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  permissionId?: string;
  isPartial: boolean;
  timestamp: number;
}

export type SessionStatus = 'idle' | 'running' | 'completed' | 'error';

export type ActivityPhase = 'idle' | 'thinking' | 'writing' | 'tool' | 'awaiting' | 'completed' | 'error';

export interface ActivityStatus {
  phase: ActivityPhase;
  toolName?: string;
}

export interface SessionMeta {
  sessionId?: string;
  stdinId?: string;
  model?: string;
  turns?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TabData {
  tabId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  partialText: string;
  partialThinking: string;
  sessionStatus: SessionStatus;
  sessionMeta: SessionMeta;
  activityStatus: ActivityStatus;
  inputDraft: string;
  pendingUserMessages: string[];
}

let messageCounter = 0;

export function generateMessageId(): string {
  messageCounter += 1;
  return `msg_${Date.now()}_${messageCounter}`;
}

function createTab(tabId: string): TabData {
  return {
    tabId,
    messages: [],
    isStreaming: false,
    partialText: '',
    partialThinking: '',
    sessionStatus: 'idle',
    sessionMeta: {},
    activityStatus: { phase: 'idle' },
    inputDraft: '',
    pendingUserMessages: [],
  };
}

interface ChatState {
  tabs: Map<string, TabData>;

  ensureTab: (tabId: string) => void;
  removeTab: (tabId: string) => void;

  addMessage: (tabId: string, message: ChatMessage) => void;
  setMessages: (tabId: string, messages: ChatMessage[]) => void;
  updateMessage: (tabId: string, id: string, updates: Partial<ChatMessage>) => void;
  updatePartialMessage: (tabId: string, text: string) => void;
  updatePartialThinking: (tabId: string, text: string) => void;
  clearPartial: (tabId: string) => void;
  setSessionStatus: (tabId: string, status: SessionStatus) => void;
  setActivityStatus: (tabId: string, status: ActivityStatus) => void;
  setSessionMeta: (tabId: string, meta: Partial<SessionMeta>) => void;
  setInputDraft: (tabId: string, text: string) => void;
  addPendingMessage: (tabId: string, text: string) => void;
  shiftPendingMessage: (tabId: string) => string | undefined;
  clearPendingMessages: (tabId: string) => void;
  resetTab: (tabId: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  tabs: new Map(),

  ensureTab: (tabId) => {
    if (get().tabs.has(tabId)) return;
    const newTabs = new Map(get().tabs);
    newTabs.set(tabId, createTab(tabId));
    set({ tabs: newTabs });
  },

  removeTab: (tabId) => {
    const newTabs = new Map(get().tabs);
    newTabs.delete(tabId);
    set({ tabs: newTabs });
  },

  addMessage: (tabId, message) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    // Deduplicate by ID
    const existingIdx = tab.messages.findIndex((m) => m.id === message.id);
    const messages =
      existingIdx !== -1
        ? tab.messages.map((m, i) => (i === existingIdx ? { ...m, ...message } : m))
        : [...tab.messages, message];

    tabs.set(tabId, { ...tab, messages });
    set({ tabs });
  },

  setMessages: (tabId, messages) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;
    tabs.set(tabId, {
      ...tab,
      messages,
      partialText: '',
      partialThinking: '',
      isStreaming: false,
      sessionStatus: 'completed',
      activityStatus: { phase: 'completed' },
    });
    set({ tabs });
  },

  updateMessage: (tabId, id, updates) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      messages: tab.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    });
    set({ tabs });
  },

  updatePartialMessage: (tabId, text) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      partialText: tab.partialText + text,
      isStreaming: true,
      activityStatus:
        tab.activityStatus.phase !== 'writing'
          ? { phase: 'writing' as ActivityPhase }
          : tab.activityStatus,
    });
    set({ tabs });
  },

  updatePartialThinking: (tabId, text) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      partialThinking: tab.partialThinking + text,
      isStreaming: true,
      activityStatus:
        tab.activityStatus.phase !== 'thinking'
          ? { phase: 'thinking' as ActivityPhase }
          : tab.activityStatus,
    });
    set({ tabs });
  },

  clearPartial: (tabId) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      partialText: '',
      partialThinking: '',
      isStreaming: false,
    });
    set({ tabs });
  },

  setSessionStatus: (tabId, status) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    const isFinal = status === 'completed' || status === 'error' || status === 'idle';
    tabs.set(tabId, {
      ...tab,
      sessionStatus: status,
      ...(isFinal
        ? { isStreaming: false, partialText: '', partialThinking: '' }
        : {}),
      activityStatus:
        status === 'completed'
          ? { phase: 'completed' }
          : status === 'error'
            ? { phase: 'error' }
            : tab.activityStatus,
    });
    set({ tabs });
  },

  setActivityStatus: (tabId, status) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;
    if (tab.activityStatus.phase === status.phase && tab.activityStatus.toolName === status.toolName)
      return;

    tabs.set(tabId, { ...tab, activityStatus: status });
    set({ tabs });
  },

  setSessionMeta: (tabId, meta) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      sessionMeta: { ...tab.sessionMeta, ...meta },
    });
    set({ tabs });
  },

  setInputDraft: (tabId, text) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, { ...tab, inputDraft: text });
    set({ tabs });
  },

  addPendingMessage: (tabId, text) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, {
      ...tab,
      pendingUserMessages: [...tab.pendingUserMessages, text],
    });
    set({ tabs });
  },

  shiftPendingMessage: (tabId) => {
    const tab = get().tabs.get(tabId);
    if (!tab || tab.pendingUserMessages.length === 0) return undefined;

    const first = tab.pendingUserMessages[0];
    const tabs = new Map(get().tabs);
    tabs.set(tabId, {
      ...tab,
      pendingUserMessages: tab.pendingUserMessages.slice(1),
    });
    set({ tabs });
    return first;
  },

  clearPendingMessages: (tabId) => {
    const tabs = new Map(get().tabs);
    const tab = tabs.get(tabId);
    if (!tab) return;

    tabs.set(tabId, { ...tab, pendingUserMessages: [] });
    set({ tabs });
  },

  resetTab: (tabId) => {
    const tabs = new Map(get().tabs);
    tabs.set(tabId, createTab(tabId));
    set({ tabs });
  },
}));
