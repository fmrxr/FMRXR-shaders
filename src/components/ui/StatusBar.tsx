'use client';

import { useShaderStore } from '@/store/shader-store';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

export function StatusBar() {
  const { stats, project, editor } = useShaderStore();

  const errorCount = Object.keys(editor.errors).length;

  return (
    <div className="h-6 bg-forge-bg3 border-t border-forge-border flex items-center px-4 gap-4 flex-shrink-0">
      {/* Left: errors/status */}
      <div className="flex items-center gap-3">
        {errorCount > 0 ? (
          <span className="text-forge-red text-xs font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-red" />
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-forge-green text-xs font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-green" />
            compiled
          </span>
        )}

        <span className="text-forge-text2/40 text-xs font-mono">|</span>

        <span className="text-forge-text2 text-xs font-mono">
          {project.buffers.length} pass{project.buffers.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="flex-1" />

      {/* Right: stats + help */}
      <div className="flex items-center gap-4">
        <span className="text-forge-text2/50 text-xs font-mono">
          {stats.resolution[0]} × {stats.resolution[1]}
        </span>
        <span className="text-forge-text2/50 text-xs font-mono">
          WebGL2
        </span>
        <span className="text-forge-text2/50 text-xs font-mono">
          {project.uniforms.length} uniforms
        </span>
        <KeyboardShortcutsHelp />
      </div>
    </div>
  );
}
