import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  scope: string;
  isEnabled: boolean;
  content: string | null;
}

interface SkillState {
  skills: SkillInfo[];
  selectedPath: string | null;
  isLoading: boolean;

  fetchSkills: (projectDir?: string) => Promise<void>;
  loadContent: (path: string) => Promise<void>;
  saveSkill: (path: string, content: string) => Promise<void>;
  getSelected: () => SkillInfo | undefined;
}

export const useSkillStore = create<SkillState>()((set, get) => ({
  skills: [],
  selectedPath: null,
  isLoading: false,

  fetchSkills: async (projectDir?: string) => {
    set({ isLoading: true });
    try {
      const skills = await bridge.listSkills(projectDir);
      set({ skills, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  loadContent: async (path) => {
    set({ selectedPath: path });
    try {
      const content = await bridge.readSkill(path);
      set((state) => ({
        skills: state.skills.map((s) =>
          s.path === path ? { ...s, content } : s,
        ),
      }));
    } catch { /* ignore */ }
  },

  saveSkill: async (path, content) => {
    await bridge.writeSkill(path, content);
    set((state) => ({
      skills: state.skills.map((s) =>
        s.path === path ? { ...s, content } : s,
      ),
    }));
  },

  getSelected: () => {
    const { skills, selectedPath } = get();
    return skills.find((s) => s.path === selectedPath);
  },
}));
