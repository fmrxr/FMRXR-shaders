'use client';

import { useRef } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { useExport } from '@/hooks/useExport';
import type { ExportPreset, ExportFormat } from '@/types';
import { clsx } from 'clsx';

const PRESETS: { label: string; value: ExportPreset; dims: string }[] = [
  { label: '1:1',  value: '1:1',  dims: '1080×1080' },
  { label: '9:16', value: '9:16', dims: '1080×1920' },
  { label: '16:9', value: '16:9', dims: '1920×1080' },
  { label: '4:5',  value: '4:5',  dims: '1080×1350' },
];

interface ExportPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function ExportPanel({ canvasRef }: ExportPanelProps) {
  const { ui, setExportConfig } = useShaderStore();
  const { snapshot, toggleRecording } = useExport(canvasRef);
  const { exportConfig, isRecording } = ui;

  return (
    <div className="px-4 py-3 space-y-5">
      {/* Social presets */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-2">Preset</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setExportConfig({ preset: p.value })}
              className={clsx(
                'px-2 py-2 rounded-md text-xs font-mono transition-all text-left',
                exportConfig.preset === p.value
                  ? 'bg-forge-bg4 border border-forge-accent/40 text-forge-text'
                  : 'bg-forge-bg3 border border-forge-border text-forge-text2 hover:border-forge-border2'
              )}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-forge-text2/50 text-xs mt-0.5">{p.dims}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider">Duration</p>
          <span className="text-forge-amber text-xs font-mono">{exportConfig.duration}s</span>
        </div>
        <input
          type="range"
          min={2} max={60} step={1}
          value={exportConfig.duration}
          onChange={(e) => setExportConfig({ duration: parseInt(e.target.value) })}
          className="w-full accent-forge-accent"
          style={{
            background: `linear-gradient(to right, #6c63ff ${((exportConfig.duration - 2) / 58) * 100}%, #202030 ${((exportConfig.duration - 2) / 58) * 100}%)`,
          }}
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-forge-text2/40 text-xs font-mono">2s</span>
          <span className="text-forge-text2/40 text-xs font-mono">60s</span>
        </div>
      </div>

      {/* FPS */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-2">Frame Rate</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[24, 30, 60].map((fps) => (
            <button
              key={fps}
              onClick={() => setExportConfig({ fps })}
              className={clsx(
                'px-2 py-1.5 rounded text-xs font-mono transition-all',
                exportConfig.fps === fps
                  ? 'bg-forge-accent/20 border border-forge-accent/50 text-forge-accent'
                  : 'bg-forge-bg3 border border-forge-border text-forge-text2 hover:border-forge-border2'
              )}
            >
              {fps} fps
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={snapshot}
          className="w-full px-3 py-2.5 rounded-md border border-forge-accent3/40 text-forge-accent3 text-xs font-mono font-semibold hover:bg-forge-accent3/10 transition-colors"
        >
          📷 PNG Snapshot
        </button>

        <button
          onClick={toggleRecording}
          className={clsx(
            'w-full px-3 py-2.5 rounded-md border text-xs font-mono font-semibold transition-colors',
            isRecording
              ? 'border-forge-red/60 text-forge-red bg-forge-red/10 animate-pulse'
              : 'border-forge-accent2/40 text-forge-accent2 hover:bg-forge-accent2/10'
          )}
        >
          {isRecording ? '⏹ Stop Recording' : '⏺ Record WebM / MP4'}
        </button>

        <button
          onClick={snapshot}
          className="w-full px-3 py-2.5 rounded-md border border-forge-amber/40 text-forge-amber text-xs font-mono font-semibold hover:bg-forge-amber/10 transition-colors"
        >
          🎞 Export GIF (Beta)
        </button>
      </div>

      {/* Info */}
      <div className="bg-forge-bg3 rounded-md p-3">
        <p className="text-forge-text2/60 text-xs font-mono leading-relaxed">
          Video records at canvas resolution. Set quality 1× for max quality exports.
          GIF uses frame capture — render at target size first.
        </p>
      </div>
    </div>
  );
}
