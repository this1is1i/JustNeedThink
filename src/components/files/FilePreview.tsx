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
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-3 py-2 text-xs"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
          {fileName}
        </span>
        <button
          onClick={() => onSave(path, content || '')}
          className="rounded px-2 py-0.5 text-xs transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Save
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
            value={content || ''}
            extensions={getLanguageExtension(path) ? [getLanguageExtension(path)!] : []}
            theme="dark"
            editable
            onChange={(value) => {
              onSave(path, value);
            }}
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
