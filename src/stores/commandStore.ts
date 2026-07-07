import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface PaletteCommand {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface CommandState {
  commands: PaletteCommand[];
  isOpen: boolean;
  query: string;
  selectedIndex: number;

  fetchCommands: () => Promise<void>;
  open: () => void;
  close: () => void;
  setQuery: (q: string) => void;
  setSelectedIndex: (i: number) => void;
  getFiltered: () => PaletteCommand[];
}

function fuzzyMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 60;

  // Character-by-character match
  let score = 0;
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) { score += 10; qi++; }
  }
  return qi === q.length ? score : 0;
}

export const useCommandStore = create<CommandState>()((set, get) => ({
  commands: [],
  isOpen: false,
  query: '',
  selectedIndex: 0,

  fetchCommands: async () => {
    try {
      const cmds = await bridge.listBuiltinCommands();
      set({ commands: cmds });
    } catch { /* offline — use defaults */ }
  },

  open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: '', selectedIndex: 0 }),
  setQuery: (q) => set({ query: q, selectedIndex: 0 }),
  setSelectedIndex: (i) => set({ selectedIndex: i }),

  getFiltered: () => {
    const { commands, query } = get();
    if (!query.trim()) return commands;
    const scored = commands
      .map((c) => ({ cmd: c, score: fuzzyMatch(`${c.name} ${c.description}`, query) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((s) => s.cmd);
  },
}));
