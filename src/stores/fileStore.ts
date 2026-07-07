import { create } from 'zustand';
import { bridge, type FileNode } from '../lib/tauri-bridge';

interface FileState {
  tree: FileNode[];
  selectedPath: string | null;
  previewContent: string | null;
  previewPath: string | null;
  isLoading: boolean;
  cwd: string | null;

  loadTree: (path: string, depth?: number) => Promise<void>;
  selectFile: (path: string) => void;
  loadPreview: (path: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  refreshTree: () => Promise<void>;
}

export const useFileStore = create<FileState>()((set, get) => ({
  tree: [],
  selectedPath: null,
  previewContent: null,
  previewPath: null,
  isLoading: false,
  cwd: null,

  loadTree: async (path, depth = 3) => {
    set({ isLoading: true, cwd: path });
    try {
      const tree = await bridge.readFileTree(path, depth);
      set({ tree, isLoading: false });
    } catch (err) {
      console.error('Failed to load file tree:', err);
      set({ isLoading: false });
    }
  },

  selectFile: (path) => {
    set({ selectedPath: path });
  },

  loadPreview: async (path) => {
    try {
      const content = await bridge.readFileContent(path);
      set({ previewContent: content, previewPath: path });
    } catch (err) {
      set({ previewContent: `Error loading file: ${err}`, previewPath: path });
    }
  },

  createDirectory: async (path) => {
    await bridge.createDirectory(path);
    await get().refreshTree();
  },

  deleteFile: async (path) => {
    await bridge.deleteFile(path);
    if (get().selectedPath === path) {
      set({ selectedPath: null, previewContent: null, previewPath: null });
    }
    await get().refreshTree();
  },

  writeFile: async (path, content) => {
    await bridge.writeFileContent(path, content);
    if (get().previewPath === path) {
      set({ previewContent: content });
    }
  },

  refreshTree: async () => {
    const { cwd } = get();
    if (cwd) {
      await get().loadTree(cwd);
    }
  },
}));
