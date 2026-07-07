import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  createdAt: number;
  sessionCount: number;
  isArchived: boolean;
  gitBranch: string | null;
}

interface ProjectState {
  projects: ProjectInfo[];
  activeProjectId: string | null;
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, path: string) => Promise<ProjectInfo>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string) => Promise<void>;
  getActiveProject: () => ProjectInfo | undefined;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await bridge.listProjects();
      set({ projects, isLoading: false });
      // Auto-select first project if none active
      if (!get().activeProjectId && projects.length > 0) {
        set({ activeProjectId: projects[0].id });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  createProject: async (name, path) => {
    const proj = await bridge.createProject(name, path);
    set((state) => ({
      projects: [proj, ...state.projects],
      activeProjectId: proj.id,
    }));
    return proj;
  },

  removeProject: async (id) => {
    await bridge.removeProject(id);
    set((state) => {
      const filtered = state.projects.filter((p) => p.id !== id);
      return {
        projects: filtered,
        activeProjectId:
          state.activeProjectId === id
            ? filtered[0]?.id ?? null
            : state.activeProjectId,
      };
    });
  },

  setActiveProject: async (id) => {
    set({ activeProjectId: id });
    await bridge.touchProject(id);
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },
}));
