import { useEffect } from 'react';
import { useWorkflowStore, type WorkflowDefinition } from '../../stores/workflowStore';

function WorkflowCard({ wf, selected, onSelect }: {
  wf: WorkflowDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full border-b px-3 py-3 text-left text-sm transition-colors"
      style={{
        backgroundColor: selected ? 'var(--color-surface)' : 'transparent',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="font-medium" style={{ color: selected ? 'var(--color-accent)' : 'var(--color-text)' }}>
        {wf.name}
      </div>
      <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-text-muted)' }}>{wf.description}</div>
      <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>{wf.steps.length} steps</span>
        <span>v{wf.version}</span>
      </div>
    </button>
  );
}

function StepTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    shell: 'var(--color-info)',
    agent: 'var(--color-accent)',
    approval: 'var(--color-warning)',
    parallel: 'var(--color-success)',
    condition: 'var(--color-text-muted)',
  };
  return (
    <span
      className="rounded px-1.5 py-0 text-[10px] font-medium"
      style={{ backgroundColor: 'var(--color-bg-tertiary)', color: colors[type] || 'var(--color-text-muted)' }}
    >
      {type}
    </span>
  );
}

export function WorkflowPanel() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows);
  const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow);
  const getSelected = useWorkflowStore((s) => s.getSelected);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const selected = getSelected();

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="border-b px-3 py-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        WORKFLOWS
      </div>

      {/* Workflow list */}
      <div className="max-h-[40%] overflow-y-auto">
        {workflows.map((wf) => (
          <WorkflowCard key={wf.id} wf={wf} selected={wf.id === selectedId} onSelect={() => selectWorkflow(wf.id)} />
        ))}
      </div>

      {/* Selected workflow detail */}
      <div className="flex-1 overflow-y-auto border-t" style={{ borderColor: 'var(--color-border)' }}>
        {selected ? (
          <div>
            <div className="border-b px-3 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selected.name}</div>
              <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-text-muted)' }}>{selected.description}</div>
            </div>
            <div className="px-2 py-1">
              {selected.steps.map((step, i) => (
                <div
                  key={step.id}
                  className="flex items-start gap-2 border-b px-2 py-3 text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {/* Step number connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
                    >
                      {i + 1}
                    </div>
                    {i < selected.steps.length - 1 && (
                      <div className="h-full w-0.5 min-h-[16px]" style={{ backgroundColor: 'var(--color-border)' }} />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{step.name}</span>
                      <StepTypeBadge type={step.type} />
                    </div>
                    {step.command && (
                      <code className="mt-0.5 block rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                        $ {step.command}
                      </code>
                    )}
                    {step.agent && (
                      <div className="mt-0.5" style={{ color: 'var(--color-accent)' }}>
                        Agent: {step.agent}
                      </div>
                    )}
                    {step.dependsOn.length > 0 && (
                      <div className="mt-0.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        Depends on: {step.dependsOn.join(', ')}
                      </div>
                    )}
                    {step.parallelWith.length > 0 && (
                      <div className="mt-0.5 text-[10px]" style={{ color: 'var(--color-success)' }}>
                        Parallel with: {step.parallelWith.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Select a workflow
          </div>
        )}
      </div>
    </div>
  );
}
