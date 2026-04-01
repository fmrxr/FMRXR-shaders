'use client';

import { useState } from 'react';
import { SHORTCUT_LABELS } from '@/lib/keyboard-shortcuts';

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const shortcuts = [
    { action: 'Toggle play/pause', key: SHORTCUT_LABELS.togglePlay },
    { action: 'Compile shader',    key: SHORTCUT_LABELS.compileShader },
    { action: 'Save shader',       key: SHORTCUT_LABELS.saveShader },
    { action: 'PNG snapshot',      key: SHORTCUT_LABELS.snapshot },
    { action: 'Reset time',        key: SHORTCUT_LABELS.resetTime },
    { action: 'Toggle sidebar',    key: SHORTCUT_LABELS.toggleSidebar },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-forge-text2/40 hover:text-forge-text2 transition-colors text-xs font-mono"
        title="Keyboard shortcuts"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-forge-bg2 border border-forge-border2 rounded-xl p-6 w-80 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-forge-text font-sans font-bold text-base">Keyboard Shortcuts</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-forge-text2 hover:text-forge-text text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {shortcuts.map(s => (
                <div key={s.action} className="flex items-center justify-between">
                  <span className="text-forge-text2 text-sm">{s.action}</span>
                  <kbd className="text-xs">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
