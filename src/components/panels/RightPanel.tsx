'use client';

import { useRef } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { UniformsPanel } from './UniformsPanel';
import { BuffersPanel } from './BuffersPanel';
import { ExportPanel } from './ExportPanel';
import { InfoPanel } from './InfoPanel';
import { clsx } from 'clsx';

const TABS = [
  { id: 'uniforms', label: 'Uniforms' },
  { id: 'buffers',  label: 'Buffers'  },
  { id: 'export',   label: 'Export'   },
  { id: 'info',     label: 'Info'     },
] as const;

interface RightPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function RightPanel({ canvasRef }: RightPanelProps) {
  const { ui, setRightPanelTab } = useShaderStore();

  return (
    <div className="w-64 flex-shrink-0 bg-forge-bg2 border-l border-forge-border flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-forge-border bg-forge-bg3 flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={clsx(
              'flex-1 px-1 py-2.5 text-xs font-mono transition-colors border-b-2',
              ui.rightPanelTab === tab.id
                ? 'text-forge-accent border-forge-accent'
                : 'text-forge-text2 border-transparent hover:text-forge-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {ui.rightPanelTab === 'uniforms' && <UniformsPanel />}
        {ui.rightPanelTab === 'buffers'  && <BuffersPanel />}
        {ui.rightPanelTab === 'export'   && <ExportPanel canvasRef={canvasRef} />}
        {ui.rightPanelTab === 'info'     && <InfoPanel />}
      </div>
    </div>
  );
}
