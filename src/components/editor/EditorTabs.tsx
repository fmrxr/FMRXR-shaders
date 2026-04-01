'use client';

import { useShaderStore } from '@/store/shader-store';
import { clsx } from 'clsx';

export function EditorTabs() {
  const { project, editor, setActiveBuffer, addBuffer, removeBuffer } = useShaderStore();

  const compileStatus = (bufferId: string) => {
    if (editor.errors[bufferId]) return 'error';
    if (editor.compiledBuffers.has(bufferId)) return 'ok';
    return 'idle';
  };

  return (
    <div className="flex items-center bg-forge-bg3 border-b border-forge-border overflow-x-auto flex-shrink-0">
      {project.buffers.map((buf) => {
        const status = compileStatus(buf.id);
        const isActive = editor.activeBufferId === buf.id;

        return (
          <div
            key={buf.id}
            className={clsx(
              'group flex items-center gap-2 px-4 py-2 cursor-pointer select-none whitespace-nowrap text-sm font-mono border-b-2 transition-all',
              isActive
                ? 'text-forge-accent border-forge-accent'
                : 'text-forge-text2 border-transparent hover:text-forge-text'
            )}
            onClick={() => setActiveBuffer(buf.id)}
          >
            <StatusDot status={status} />
            <span>{buf.label}</span>
            {buf.id !== 'image' && (
              <button
                onClick={(e) => { e.stopPropagation(); removeBuffer(buf.id); }}
                className="opacity-0 group-hover:opacity-100 text-forge-text2 hover:text-forge-red transition-all text-xs ml-1"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {/* Add buffer */}
      {project.buffers.filter(b => b.id !== 'image').length < 4 && (
        <button
          onClick={addBuffer}
          className="px-3 py-2 text-forge-text2 hover:text-forge-text text-lg leading-none flex-shrink-0 transition-colors"
          title="Add buffer"
        >
          +
        </button>
      )}

      {/* Compile status + button */}
      <div className="ml-auto flex items-center gap-3 pr-3 flex-shrink-0">
        <CompileStatus bufferId={editor.activeBufferId} />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'error' | 'idle' }) {
  return (
    <span
      className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
        'bg-forge-green': status === 'ok',
        'bg-forge-red':   status === 'error',
        'bg-forge-text2 opacity-40': status === 'idle',
      })}
    />
  );
}

function CompileStatus({ bufferId }: { bufferId: string }) {
  const { editor } = useShaderStore();
  const error = editor.errors[bufferId];
  const compiled = editor.compiledBuffers.has(bufferId);

  if (error) {
    return <span className="text-forge-red text-xs font-mono">● error</span>;
  }
  if (compiled) {
    return <span className="text-forge-green text-xs font-mono">● compiled</span>;
  }
  return <span className="text-forge-text2 text-xs font-mono opacity-50">● pending</span>;
}
