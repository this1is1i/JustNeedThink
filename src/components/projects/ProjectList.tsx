import type { ProjectInfo } from '../../stores/projectStore';

interface ProjectListProps {
  projects: ProjectInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ProjectList({ projects, activeId, onSelect, onDelete, onNew }: ProjectListProps) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          PROJECTS
        </span>
        <button
          onClick={onNew}
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No projects yet. Click "+ Add" to create one.
          </div>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group w-full border-b px-3 py-2.5 text-left transition-colors"
              style={{
                backgroundColor: p.id === activeId ? 'var(--color-surface)' : 'transparent',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="truncate text-sm font-medium"
                  style={{
                    color: p.id === activeId ? 'var(--color-accent)' : 'var(--color-text)',
                  }}
                >
                  {p.name}
                </span>
                <button
                  className="hidden rounded px-1 text-xs opacity-50 hover:opacity-100 group-hover:inline-block"
                  style={{ color: 'var(--color-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {p.path}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span>{p.sessionCount} sessions</span>
                {p.gitBranch && (
                  <span style={{ color: 'var(--color-info)' }}>⎇ {p.gitBranch}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
