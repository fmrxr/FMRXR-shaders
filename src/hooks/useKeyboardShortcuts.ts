'use client';

import { useEffect } from 'react';
import { initKeyboardShortcuts } from '@/lib/keyboard-shortcuts';
import { useShaderStore } from '@/store/shader-store';
import { exportPNG } from '@/lib/export-engine';

export function useKeyboardShortcuts(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onSave: () => void,
  onCompile: () => void
) {
  const { setRunning, isRunning, toggleSidebar } = useShaderStore();

  useEffect(() => {
    const cleanup = initKeyboardShortcuts({
      togglePlay:    () => setRunning(!isRunning),
      resetTime:     () => {/* handled via engine ref */},
      saveShader:    onSave,
      snapshot:      () => { if (canvasRef.current) exportPNG(canvasRef.current); },
      toggleSidebar,
      compileShader: onCompile,
    });
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);
}
