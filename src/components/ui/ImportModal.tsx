'use client';

import { useState } from 'react';
import { useShaderStore } from '@/store/shader-store';
import type { ImportResult, ImportWarning } from '@/lib/shadertoy-importer';

interface Props {
  onClose: () => void;
}

export function ImportModal({ onClose }: Props) {
  const { setProject } = useShaderStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [imported, setImported] = useState(false);

  const isValidUrl = url.trim().length > 0 &&
    (url.includes('shadertoy.com/view/') || /^[A-Za-z0-9_]{4,10}$/.test(url.trim()));

  const handleImport = async () => {
    if (!isValidUrl) return;
    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch(`/api/import-shadertoy?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json() as ImportResult & { error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? 'Import failed');
        return;
      }

      setProject(data.project);
      setWarnings(data.warnings ?? []);
      setImported(true);

      if ((data.warnings ?? []).length === 0) {
        onClose();
      }
    } catch {
      setError('Network error — could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleImport();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-forge-bg2 border border-forge-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-forge-border">
          <div>
            <h2 className="text-forge-text font-semibold text-sm">Import from Shadertoy</h2>
            <p className="text-forge-text2 text-xs mt-0.5">Public shaders only</p>
          </div>
          <button
            onClick={onClose}
            className="text-forge-text2 hover:text-forge-text transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* URL input */}
          <div>
            <label className="block text-xs font-mono text-forge-text2 mb-2">
              Shader URL or ID
            </label>
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); setImported(false); }}
              onKeyDown={handleKeyDown}
              placeholder="https://www.shadertoy.com/view/tsKXR3"
              autoFocus
              className="w-full bg-forge-bg3 border border-forge-border2 rounded-lg px-3 py-2.5 text-sm font-mono text-forge-text placeholder-forge-text2/40 focus:outline-none focus:border-forge-accent transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-forge-red/10 border border-forge-red/20 rounded-lg px-3 py-2.5">
              <p className="text-forge-red text-xs font-mono">{error}</p>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-forge-amber/10 border border-forge-amber/20 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-forge-amber text-xs font-mono font-semibold mb-1.5">
                Imported with warnings:
              </p>
              {warnings.map((w, i) => (
                <p key={i} className="text-forge-amber/80 text-xs font-mono">• {w.message}</p>
              ))}
            </div>
          )}

          {/* Success with warnings */}
          {imported && warnings.length > 0 && (
            <div className="bg-forge-green/10 border border-forge-green/20 rounded-lg px-3 py-2">
              <p className="text-forge-green text-xs font-mono">Shader imported successfully</p>
            </div>
          )}

          {/* Info */}
          {!error && !imported && (
            <p className="text-forge-text2/60 text-xs font-mono leading-relaxed">
              Paste a Shadertoy URL or bare shader ID. Only shaders set to &quot;Public&quot; can be imported.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-forge-border bg-forge-bg3">
          {imported && warnings.length > 0 ? (
            <button onClick={onClose} className="btn-primary text-xs">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!isValidUrl || loading}
                className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Import Shader'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
