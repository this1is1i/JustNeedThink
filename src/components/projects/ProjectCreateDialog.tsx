import { useState } from 'react';

interface ProjectCreateDialogProps {
  onClose: () => void;
  onCreate: (name: string, path: string) => Promise<void>;
}

export function ProjectCreateDialog({ onClose, onCreate }: ProjectCreateDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !path.trim()) {
      setError('Name and path are required');
      return;
    }
    try {
      await onCreate(name.trim(), path.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="jnt-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="jnt-card jnt-gradient-border jnt-animate-in w-full max-w-md p-6"
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="mb-4 text-lg font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          New Project
        </h3>

        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full rounded border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              autoFocus
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Project Path
            </label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="D:\Projects\my-app"
              className="w-full rounded border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {error && (
            <div className="text-xs" style={{ color: 'var(--color-error)' }}>
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="jnt-btn-ghost px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="jnt-btn-accent px-4 py-2 text-sm"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
