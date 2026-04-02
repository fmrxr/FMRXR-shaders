'use client';

import { useEffect, useRef, useCallback } from 'react';
import { ShaderEngine } from '@/lib/shader-engine';
import { useShaderStore } from '@/store/shader-store';
import type { ShaderProject } from '@/types';

export function useShaderEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  externalEngineRef?: React.RefObject<ShaderEngine | null>
) {
  const internalRef = useRef<ShaderEngine | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = (externalEngineRef ?? internalRef) as React.MutableRefObject<ShaderEngine | null>;
  const store = useShaderStore();

  const {
    project, isRunning, ui,
    setError, setCompiled, updateStats, setRunning,
  } = store;

  // ─── Initialize engine ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ShaderEngine(canvas, {
      onFpsUpdate: (fps) => updateStats({ fps }),
      onFrameUpdate: (frame, time) => updateStats({ frame, time }),
      onError:   (bufferId, error) => setError(bufferId, error),
      onCompileSuccess: (bufferId) => setCompiled(bufferId),
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  // ─── Compile all buffers when project changes ────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const bufferOrder = project.buffers.map(b => b.id);
    engine.setBufferOrder(bufferOrder);
    engine.setBufferDefs(project.buffers);

    for (const buffer of project.buffers) {
      engine.compileBuffer(buffer);
    }
    engine.setUniformDefs(project.uniforms);

    // Kick off async texture loading for any URL channels (fire-and-forget)
    engine.loadChannelTextures(project.buffers).catch(console.warn);
  }, [project.buffers]);

  // ─── Sync uniforms ───────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setUniformDefs(project.uniforms);
  }, [project.uniforms]);

  // ─── Play / pause ────────────────────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isRunning) engine.start();
    else engine.pause();
  }, [isRunning]);

  // ─── Quality → canvas resize ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = Math.floor(rect.width  * ui.quality * window.devicePixelRatio);
      const h = Math.floor(rect.height * ui.quality * window.devicePixelRatio);
      canvas.width  = w;
      canvas.height = h;
      engine.resize(w, h);
      updateStats({ resolution: [w, h] });
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.quality]);

  // ─── Mouse tracking ──────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const y = canvas.height - (e.clientY - rect.top)  * (canvas.height / rect.height);
    engine.setMouse(x, y);
  }, [canvasRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const y = canvas.height - (e.clientY - rect.top)  * (canvas.height / rect.height);
    engine.setMouse(x, y, true);
  }, [canvasRef]);

  const resetTime = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  const togglePlay = useCallback(() => {
    setRunning(!isRunning);
  }, [isRunning, setRunning]);

  return {
    engine: engineRef,
    handleMouseMove,
    handleMouseDown,
    resetTime,
    togglePlay,
  };
}
