'use client';

import { useEffect, useRef } from 'react';
import { useShaderStore } from '@/store/shader-store';
import type { ShaderEngine } from '@/lib/shader-engine';

export function useAutoCompile(
  engineRef: React.MutableRefObject<ShaderEngine | null>,
  delay = 600
) {
  const { project, editor } = useShaderStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const buf = project.buffers.find(b => b.id === editor.activeBufferId);
      if (buf) engine.compileBuffer(buf);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // Only trigger when active buffer's code changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.buffers.find(b => b.id === editor.activeBufferId)?.code]);
}
