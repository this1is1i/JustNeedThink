import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'shell' | 'agent' | 'approval' | 'parallel' | 'condition';
  command?: string;
  agent?: string;
  prompt?: string;
  dependsOn: string[];
  parallelWith: string[];
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStep[];
  createdAt: number;
  modifiedAt: number;
}

interface WorkflowState {
  workflows: WorkflowDefinition[];
  selectedId: string | null;
  isLoading: boolean;

  fetchWorkflows: () => Promise<void>;
  selectWorkflow: (id: string) => void;
  getSelected: () => WorkflowDefinition | undefined;
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  workflows: [],
  selectedId: null,
  isLoading: false,

  fetchWorkflows: async () => {
    set({ isLoading: true });
    try {
      const wfs = await bridge.listWorkflows();
      set({ workflows: wfs, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  selectWorkflow: (id) => set({ selectedId: id }),

  getSelected: () => {
    const { workflows, selectedId } = get();
    return workflows.find((w) => w.id === selectedId);
  },
}));
