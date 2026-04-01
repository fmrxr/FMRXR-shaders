'use client';

import { useRef, useCallback, useState } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  direction?: 'vertical' | 'horizontal';
}

export function ResizablePanel({
  children,
  defaultHeight = 280,
  minHeight = 120,
  maxHeight = 600,
}: ResizablePanelProps) {
  const [height, setHeight] = useState(defaultHeight);
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startH   = useRef(defaultHeight);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current   = e.clientY;
    startH.current   = height;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const next  = Math.min(maxHeight, Math.max(minHeight, startH.current + delta));
      setHeight(next);
    };

    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [height, maxHeight, minHeight]);

  return (
    <div style={{ height }} className="flex flex-col overflow-hidden flex-shrink-0">
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="h-1 bg-forge-border hover:bg-forge-accent/40 cursor-row-resize transition-colors flex-shrink-0 group"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 bg-forge-border2 group-hover:bg-forge-accent/60 mx-auto mt-px rounded-full transition-colors" />
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
