'use client';

import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

let toastCallback: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null;

export function toast(msg: Omit<ToastMessage, 'id'>) {
  toastCallback?.(msg);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastCallback = (msg) => {
      const id = Math.random().toString(36).slice(2);
      const item: ToastMessage = { id, duration: 3000, ...msg };
      setToasts(prev => [...prev, item]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, item.duration);
    };
    return () => { toastCallback = null; };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'px-4 py-2.5 rounded-lg border text-sm font-mono shadow-xl backdrop-blur-sm transition-all animate-in slide-in-from-bottom-2',
            {
              'bg-forge-green/10 border-forge-green/30 text-forge-green':   t.type === 'success',
              'bg-forge-red/10   border-forge-red/30   text-forge-red':     t.type === 'error',
              'bg-forge-accent/10 border-forge-accent/30 text-forge-accent': t.type === 'info',
              'bg-forge-amber/10 border-forge-amber/30 text-forge-amber':   t.type === 'warning',
            }
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
