import { useEffect } from 'react';
import { useSkillStore } from '../../stores/skillStore';

export function SkillsPanel() {
  const skills = useSkillStore((s) => s.skills);
  const selectedPath = useSkillStore((s) => s.selectedPath);
  const isLoading = useSkillStore((s) => s.isLoading);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const loadContent = useSkillStore((s) => s.loadContent);
  const getSelected = useSkillStore((s) => s.getSelected);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const selected = getSelected();

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="border-b px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        SKILLS
      </div>

      {/* Skill list */}
      <div className="max-h-[45%] overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : skills.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No skills found. Add SKILL.md files to ~/.claude/skills/ or your project's .claude/skills/.
          </div>
        ) : (
          skills.map((s) => (
            <button
              key={s.path}
              onClick={() => loadContent(s.path)}
              className="w-full border-b px-3 py-2 text-left text-xs transition-colors"
              style={{
                backgroundColor: s.path === selectedPath ? 'var(--color-surface)' : 'transparent',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium" style={{ color: s.path === selectedPath ? 'var(--color-accent)' : 'var(--color-text)' }}>
                  {s.name}
                </span>
                <span
                  className="rounded px-1 py-0 text-[10px]"
                  style={{
                    backgroundColor: s.scope === 'global' ? 'var(--color-bg-tertiary)' : 'var(--color-surface)',
                    color: s.scope === 'global' ? 'var(--color-info)' : 'var(--color-success)',
                  }}
                >
                  {s.scope}
                </span>
              </div>
              <div className="truncate" style={{ color: 'var(--color-text-muted)' }}>{s.description}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{s.path}</div>
            </button>
          ))
        )}
      </div>

      {/* Skill preview */}
      <div className="flex-1 overflow-auto border-t" style={{ borderColor: 'var(--color-border)' }}>
        {selected ? (
          <div>
            <div className="border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{selected.name}</span>
              <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>{selected.scope}</span>
            </div>
            <pre
              className="whitespace-pre-wrap p-3 text-xs leading-relaxed"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}
            >
              {selected.content || 'Loading...'}
            </pre>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Select a skill to preview
          </div>
        )}
      </div>
    </div>
  );
}
