'use client';

import { useShaderStore } from '@/store/shader-store';
import { clsx } from 'clsx';

export function BuffersPanel() {
  const { project, setActiveBuffer, editor } = useShaderStore();

  const buffers = project.buffers;
  const nonImageBuffers = buffers.filter((b) => b.id !== 'image');

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Buffer list */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-3">Passes</p>
        <div className="space-y-1.5">
          {buffers.map((buf, i) => {
            const isActive = editor.activeBufferId === buf.id;
            const hasError = !!editor.errors[buf.id];
            const isCompiled = editor.compiledBuffers.has(buf.id);

            return (
              <button
                key={buf.id}
                onClick={() => setActiveBuffer(buf.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all text-xs font-mono',
                  isActive
                    ? 'bg-forge-bg4 border border-forge-accent/30 text-forge-text'
                    : 'bg-forge-bg3 border border-forge-border text-forge-text2 hover:border-forge-border2'
                )}
              >
                <span
                  className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
                    'bg-forge-green': isCompiled && !hasError,
                    'bg-forge-red': hasError,
                    'bg-forge-text2/30': !isCompiled && !hasError,
                  })}
                />
                <span className="flex-1">{buf.label}</span>
                <span className="text-forge-text2/40">Pass {i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* iChannel routing diagram */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-3">
          Channel Routing (Image)
        </p>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((ch) => {
            const assigned = nonImageBuffers[ch];
            return (
              <div key={ch} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-forge-accent2 w-16 flex-shrink-0">iChannel{ch}</span>
                <span className="text-forge-text2/40">→</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs',
                    assigned
                      ? 'bg-forge-accent3/10 text-forge-accent3 border border-forge-accent3/20'
                      : 'text-forge-text2/30'
                  )}
                >
                  {assigned?.label ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-forge-text2/40 text-xs font-mono mt-3 leading-relaxed">
          Buffers are auto-routed. Buffer A → iChannel0, Buffer B → iChannel1, etc.
        </p>
      </div>

      {/* Render order */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-3">
          Render Order
        </p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {buffers.map((buf, i) => (
            <div key={buf.id} className="flex items-center gap-1.5">
              <span className="px-2 py-1 rounded bg-forge-bg3 border border-forge-border text-forge-text2 text-xs font-mono">
                {buf.label}
              </span>
              {i < buffers.length - 1 && (
                <span className="text-forge-text2/30 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
