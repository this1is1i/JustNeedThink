import { useState, useEffect, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { sql } from '@codemirror/lang-sql';

interface FilePreviewProps {
  path: string | null;
  content: string | null;
  onSave: (path: string, content: string) => Promise<void>;
}

function getExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getLanguageExtension(path: string) {
  const ext = getExtension(path);
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx':
      return javascript({ jsx: true, typescript: ext === 'ts' || ext === 'tsx' });
    case 'py': return python();
    case 'rs': return rust();
    case 'json': return json();
    case 'md': return markdown();
    case 'css': return css();
    case 'html': case 'htm': return html();
    case 'sql': return sql();
    case 'yaml': case 'yml': case 'toml':
      return undefined; // plain text for config files
    default: return undefined;
  }
}

export function FilePreview({ path, content, onSave }: FilePreviewProps) {
  // Local draft — edits stay in memory until an explicit Save (avoids a disk
  // write on every keystroke). Re-syncs whenever the loaded file changes.
  const [draft, setDraft] = useState(content ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(content ?? '');
  }, [path, content]);

  // Compute the language extension once per file, not twice per render.
  const langExtensions = useMemo(() => {
    const ext = path ? getLanguageExtension(path) : undefined;
    return ext ? [ext] : [];
  }, [path]);

  const dirty = content !== null && content !== undefined && draft !== content;

  const handleSave = useCallback(async () => {
    if (!path || !dirty) return;
    setSaving(true);
    try {
      await onSave(path, draft);
    } finally {
      setSaving(false);
    }
  }, [path, draft, dirty, onSave]);

  if (!path) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Select a file to preview
      </div>
    );
  }

  const fileName = path.split(/[/\\]/).pop() || path;
  const isText = content !== null && content !== undefined;
  const isImage = /\.(png|jpg|jpeg|gif|svg|ico)$/i.test(path);

  return (
    <div className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2 text-xs"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="flex min-w-0 items-center gap-1.5 font-medium" style={{ color: 'var(--color-text)' }}>
          {dirty && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--color-warning)' }} title="Unsaved changes" />
          )}
          <span className="truncate">{fileName}</span>
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="jnt-btn-accent px-2.5 py-0.5 text-xs"
        >
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {isImage ? (
          <div className="flex h-full items-center justify-center p-4">
            <img
              src={`asset://localhost/${encodeURI(path)}`}
              alt={fileName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : isText ? (
          <CodeMirror
            value={draft}
            extensions={langExtensions}
            theme="dark"
            editable
            onChange={setDraft}
            style={{ height: '100%', fontSize: '13px' }}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
              foldGutter: true,
              autocompletion: true,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Cannot preview this file type
          </div>
        )}
      </div>
    </div>
  );
}
