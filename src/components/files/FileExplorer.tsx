import { useState } from 'react';
import type { FileNode } from '../../lib/tauri-bridge';

interface FileExplorerProps {
  tree: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  isLoading: boolean;
}

function FileTreeNode({ node, depth, selectedPath, onSelect, onDelete }: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`jnt-row group mx-1 flex cursor-pointer items-center gap-1 rounded-md py-0.5 pr-1 text-sm ${selectedPath === node.path ? 'jnt-row-active' : ''}`}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          color: selectedPath === node.path ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        }}
        onClick={() => {
          if (node.isDir && hasChildren) {
            setExpanded(!expanded);
          }
          onSelect(node.path);
        }}
      >
        <span
          className="inline-flex w-4 justify-center text-xs"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setExpanded(!expanded);
            }
          }}
        >
          {node.isDir ? (expanded ? '▾' : '▸') : ' '}
        </span>
        <span className="text-xs">{node.isDir ? '📁' : '📄'}</span>
        <span className="flex-1 truncate">{node.name}</span>
        <button
          className="hidden rounded px-1 text-xs opacity-60 hover:opacity-100 group-hover:inline-block"
          style={{ color: 'var(--color-error)' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.path);
          }}
        >
          ×
        </button>
      </div>
      {node.isDir && expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {node.isDir && expanded && !hasChildren && (
        <div
          className="py-0.5 text-xs"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px`, color: 'var(--color-text-muted)' }}
        >
          (empty)
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ tree, selectedPath, onSelect, onDelete, isLoading }: FileExplorerProps) {
  const [filter, setFilter] = useState('');

  const filteredTree = filter
    ? filterNodes(tree, filter.toLowerCase())
    : tree;

  return (
    <div className="flex h-full flex-col">
      <div
        className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Files
      </div>
      <div className="px-2 pb-1.5" style={{ borderColor: 'var(--color-border)' }}>
        <input
          type="text"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-md border px-2.5 py-1 text-xs outline-none transition-colors focus:border-transparent"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : filteredTree.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No files</div>
        ) : (
          filteredTree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function filterNodes(nodes: FileNode[], query: string): FileNode[] {
  return nodes
    .filter((n) => {
      const nameMatch = n.name.toLowerCase().includes(query);
      const childMatch = n.children ? filterNodes(n.children, query).length > 0 : false;
      return nameMatch || childMatch;
    })
    .map((n) => ({
      ...n,
      children: n.children ? filterNodes(n.children, query) : null,
    }));
}
