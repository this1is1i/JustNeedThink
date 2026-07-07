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
        className="flex items-center justify-between px-3 pb-1.5 pt-3"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Projects
        </span>
        <button
          onClick={onNew}
          className="jnt-btn-ghost px-2 py-0.5 text-xs font-medium"
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5">
        {projects.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No projects yet.<br />Click "+ Add" to create one.
          </div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}
              className={`jnt-row group mb-0.5 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left ${p.id === activeId ? 'jnt-row-active' : ''}`}
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
