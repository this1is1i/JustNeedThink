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
      setError(String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{ backgroundColor: 'var(--color-surface)' }}
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

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-bg)',
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
