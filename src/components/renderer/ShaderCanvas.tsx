'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useShaderEngine } from '@/hooks/useShaderEngine';
import { useShaderStore } from '@/store/shader-store';
import { useExport } from '@/hooks/useExport';
import type { ShaderEngine } from '@/lib/shader-engine';
import { clsx } from 'clsx';

interface ShaderCanvasProps {
  engineRef?: React.RefObject<ShaderEngine | null>;
}

export function ShaderCanvas({ engineRef: externalEngineRef }: ShaderCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { handleMouseMove, handleMouseDown, resetTime, togglePlay, engine } = useShaderEngine(canvasRef, externalEngineRef);
  const { snapshot, toggleRecording } = useExport(canvasRef);
  const { stats, isRunning, ui, setQuality, setRunning } = useShaderStore();

  const QUALITY_STEPS = [0.25, 0.5, 0.75, 1.0];
  const QUALITY_LABELS = ['0.25×', '0.5×', '0.75×', '1×'];

  const cycleQuality = () => {
    const idx = QUALITY_STEPS.indexOf(ui.quality);
    const next = QUALITY_STEPS[(idx + 1) % QUALITY_STEPS.length];
    setQuality(next);
  };

  const enterFullscreen = () => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const fpsColor =
    stats.fps > 50 ? '#00ff88' :
    stats.fps > 25 ? '#ffb830' : '#ff4466';

  return (
    <div className="relative flex-1 bg-black overflow-hidden group">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
      />

      {/* Top-left stats overlay */}
      <div className="absolute top-3 left-3 flex gap-2 items-center pointer-events-none">
        <Pill style={{ color: fpsColor }}>{stats.fps} FPS</Pill>
        <Pill>{stats.resolution[0]} × {stats.resolution[1]}</Pill>
        <Pill>{stats.time.toFixed(2)}s</Pill>
      </div>

      {/* Top-right status */}
      {ui.isRecording && (
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 border border-forge-red/40 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-forge-red animate-pulse" />
          <span className="text-forge-red text-xs font-mono">REC</span>
        </div>
      )}

      {/* Bottom-right controls */}
      <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton onClick={resetTime} title="Reset time">↺</IconButton>
        <IconButton onClick={snapshot} title="Snapshot">⬡</IconButton>
        <IconButton onClick={enterFullscreen} title="Fullscreen">⛶</IconButton>
      </div>

      {/* Bottom-left controls */}
      <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={togglePlay}
          className="bg-black/70 border border-forge-border2 text-forge-text2 text-xs font-mono px-3 py-1.5 rounded-md hover:text-forge-text transition-colors"
        >
          {isRunning ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={cycleQuality}
          className="bg-black/70 border border-forge-border2 text-forge-text2 text-xs font-mono px-3 py-1.5 rounded-md hover:text-forge-text transition-colors"
        >
          {QUALITY_LABELS[QUALITY_STEPS.indexOf(ui.quality)]}
        </button>
        <button
          onClick={toggleRecording}
          className={clsx(
            'bg-black/70 border text-xs font-mono px-3 py-1.5 rounded-md transition-colors',
            ui.isRecording
              ? 'border-forge-red/60 text-forge-red'
              : 'border-forge-accent2/40 text-forge-accent2 hover:text-forge-accent2/80'
          )}
        >
          {ui.isRecording ? '⏹ Stop' : '⏺ Record'}
        </button>
      </div>
    </div>
  );
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="bg-black/60 border border-white/10 text-forge-text2 text-xs font-mono px-2.5 py-1 rounded-full"
      style={style}
    >
      {children}
    </span>
  );
}

function IconButton({ children, onClick, title }: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 bg-black/70 border border-forge-border2 text-forge-text2 rounded-md flex items-center justify-center text-sm hover:text-forge-text hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}
