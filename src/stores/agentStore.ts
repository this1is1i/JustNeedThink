import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string | null;
  model: string | null;
  tools: string[];
  isBuiltin: boolean;
  isEnabled: boolean;
  createdAt: number;
}

export interface AgentTeam {
  id: string;
  name: string;
  description: string;
  leaderAgentId: string;
  memberIds: string[];
  collaborationMode: 'sequential' | 'parallel' | 'review';
}

export interface AgentStatus {
  id: string;
  name: string;
  phase: 'spawning' | 'thinking' | 'writing' | 'tool' | 'completed' | 'error';
  tool: string | null;
  parentId: string | null;
  startedAt: number;
}

interface AgentState {
  definitions: AgentDefinition[];
  teams: AgentTeam[];
  activeAgents: AgentStatus[];
  isLoading: boolean;

  fetchDefinitions: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  clearMonitor: () => Promise<void>;
  getTeamByAgent: (agentId: string) => AgentTeam | undefined;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  definitions: [],
  teams: [],
  activeAgents: [],
  isLoading: false,

  fetchDefinitions: async () => {
    set({ isLoading: true });
    try {
      const defs = await bridge.listAgents();
      set({ definitions: defs, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchTeams: async () => {
    try {
      const teams = await bridge.listAgentTeams();
      set({ teams });
    } catch { /* ignore */ }
  },

  fetchStatus: async () => {
    try {
      const agents = await bridge.getAgentStatus();
      set({ activeAgents: agents });
    } catch { /* ignore */ }
  },

  clearMonitor: async () => {
    await bridge.clearAgentMonitor();
    set({ activeAgents: [] });
  },

  getTeamByAgent: (agentId) => {
    return get().teams.find(
      (t) => t.leaderAgentId === agentId || t.memberIds.includes(agentId),
    );
  },
}));
