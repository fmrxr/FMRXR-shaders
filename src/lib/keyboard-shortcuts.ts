'use client';

/**
 * Global keyboard shortcut registry.
 * Call registerShortcuts() once at app root.
 */

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: ShortcutHandler;
}

const shortcuts: Shortcut[] = [];

export function registerShortcut(s: Shortcut): () => void {
  shortcuts.push(s);
  return () => {
    const idx = shortcuts.indexOf(s);
    if (idx >= 0) shortcuts.splice(idx, 1);
  };
}

export function initKeyboardShortcuts(
  handlers: {
    togglePlay: () => void;
    resetTime: () => void;
    saveShader: () => void;
    snapshot: () => void;
    toggleSidebar: () => void;
    compileShader: () => void;
  }
): () => void {
  const defs: Shortcut[] = [
    { key: ' ',  ctrl: false, description: 'Toggle play/pause', handler: handlers.togglePlay },
    { key: 'r',  ctrl: true,  description: 'Reset time',        handler: handlers.resetTime   },
    { key: 's',  ctrl: true,  description: 'Save shader',       handler: handlers.saveShader  },
    { key: 'p',  ctrl: true,  description: 'Screenshot (PNG)',  handler: handlers.snapshot    },
    { key: 'b',  ctrl: true,  description: 'Toggle sidebar',    handler: handlers.toggleSidebar },
    { key: 'Enter', ctrl: true, description: 'Compile shader',  handler: handlers.compileShader },
  ];

  const listener = (e: KeyboardEvent) => {
    // Don't fire when typing in an input or textarea (except Monaco handles its own)
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;

    // Allow space only outside textareas
    if (e.key === ' ' && tag === 'TEXTAREA') return;

    for (const shortcut of defs) {
      const keyMatch   = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch  = shortcut.ctrl  === undefined ? true : e.ctrlKey === shortcut.ctrl;
      const shiftMatch = shortcut.shift === undefined ? true : e.shiftKey === shortcut.shift;

      if (keyMatch && ctrlMatch && shiftMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  };

  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

export const SHORTCUT_LABELS: Record<string, string> = {
  togglePlay:     'Space',
  resetTime:      'Ctrl+R',
  saveShader:     'Ctrl+S',
  snapshot:       'Ctrl+P',
  toggleSidebar:  'Ctrl+B',
  compileShader:  'Ctrl+Enter',
};
