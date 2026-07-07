import { useEffect } from 'react';
import { useAgentStore, type AgentStatus } from '../../stores/agentStore';

export function AgentPanel() {
  const definitions = useAgentStore((s) => s.definitions);
  const teams = useAgentStore((s) => s.teams);
  const activeAgents = useAgentStore((s) => s.activeAgents);
  const fetchDefinitions = useAgentStore((s) => s.fetchDefinitions);
  const fetchTeams = useAgentStore((s) => s.fetchTeams);
  const fetchStatus = useAgentStore((s) => s.fetchStatus);

  useEffect(() => {
    fetchDefinitions();
    fetchTeams();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchDefinitions, fetchTeams, fetchStatus]);

  const phaseIcon = (p: AgentStatus['phase']) => {
    switch (p) {
      case 'spawning': return '🔄';
      case 'thinking': return '💭';
      case 'writing': return '✍️';
      case 'tool': return '🔧';
      case 'completed': return '✅';
      case 'error': return '❌';
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="border-b px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        AGENTS
      </div>

      {/* Active agents */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Active ({activeAgents.length})
        </div>
        {activeAgents.length === 0 ? (
          <div className="px-3 pb-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No active agents. Start a chat to see sub-agents.
          </div>
        ) : (
          activeAgents.map((a) => (
            <div key={a.id} className="border-t px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-1.5">
                <span>{phaseIcon(a.phase)}</span>
                <span style={{ color: 'var(--color-text)' }}>{a.name}</span>
              </div>
              <div style={{ color: 'var(--color-text-muted)', marginLeft: '20px' }}>
                {a.phase} {a.tool ? `· ${a.tool}` : ''}
                {a.parentId ? ' (sub-agent)' : ''}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Built-in agents */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Definitions ({definitions.length})
        </div>
        {definitions.map((d) => (
          <div key={d.id} className="border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5">
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{d.name}</span>
              {d.isBuiltin && (
                <span className="rounded px-1 py-0 text-[10px]" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-accent)' }}>
                  BUILTIN
                </span>
              )}
            </div>
            <div className="mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{d.description}</div>
            {d.tools.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {d.tools.map((t) => (
                  <span key={t} className="rounded px-1 py-0 text-[10px]" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Teams */}
      <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Teams ({teams.length})
        </div>
        {teams.map((t) => (
          <div key={t.id} className="border-t px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }}>
            <div className="font-medium" style={{ color: 'var(--color-text)' }}>{t.name}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              {t.collaborationMode} · {t.memberIds.length + 1} members
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
