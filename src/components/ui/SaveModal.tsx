'use client';

import { useState } from 'react';
import type { ShaderProject } from '@/types';
import { clsx } from 'clsx';

interface SaveModalProps {
  project: ShaderProject;
  saving: boolean;
  error?: string | null;
  onSave: (title: string, description: string, tags: string[], isPublic: boolean) => void;
  onClose: () => void;
}

export function SaveModal({ project, saving, error, onSave, onClose }: SaveModalProps) {
  const [title, setTitle]       = useState(project.title);
  const [description, setDesc]  = useState(project.description ?? '');
  const [tagsStr, setTagsStr]   = useState(project.tags.join(', '));
  const [isPublic, setPublic]   = useState(project.isPublic);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    onSave(title, description, tags, isPublic);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-forge-bg2 border border-forge-border2 rounded-xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-forge-text font-sans font-bold text-lg mb-5">Save Shader</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-forge-text2 text-xs font-mono mb-1.5 block uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-forge-bg3 border border-forge-border2 text-forge-text font-mono text-sm px-3 py-2 rounded-md outline-none focus:border-forge-accent/60 transition-colors"
            />
          </div>

          <div>
            <label className="text-forge-text2 text-xs font-mono mb-1.5 block uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full bg-forge-bg3 border border-forge-border2 text-forge-text font-mono text-sm px-3 py-2 rounded-md outline-none focus:border-forge-accent/60 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-forge-text2 text-xs font-mono mb-1.5 block uppercase tracking-wider">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="plasma, wave, animation"
              className="w-full bg-forge-bg3 border border-forge-border2 text-forge-text font-mono text-sm px-3 py-2 rounded-md outline-none focus:border-forge-accent/60 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-forge-text2 text-sm font-mono">Public</span>
            <button
              type="button"
              onClick={() => setPublic(!isPublic)}
              className={clsx(
                'w-11 h-6 rounded-full transition-colors relative',
                isPublic ? 'bg-forge-accent' : 'bg-forge-bg5'
              )}
            >
              <span className={clsx(
                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                isPublic ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>

          {error && (
            <div className="bg-forge-red/10 border border-forge-red/20 rounded-lg px-3 py-2.5">
              <p className="text-forge-red text-xs font-mono font-semibold mb-0.5">Save failed</p>
              <p className="text-forge-red/80 text-xs font-mono break-all">{error}</p>
              {error.toLowerCase().includes('supabase') || error.toLowerCase().includes('fetch') ? (
                <p className="text-forge-text2/60 text-xs font-mono mt-1.5">
                  Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local
                </p>
              ) : null}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-forge-accent to-forge-accent2 text-white font-sans font-semibold py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 bg-forge-bg4 border border-forge-border2 text-forge-text2 font-sans rounded-md hover:text-forge-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
