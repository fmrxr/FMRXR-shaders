'use client';

import { useState } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { saveShader } from '@/services/supabase';
import { clsx } from 'clsx';
import { SaveModal } from './SaveModal';
import { ImportModal } from './ImportModal';

export function TopBar() {
  const { project, isRunning, setRunning, ui, toggleSidebar, editor, addSavedProject } = useShaderStore();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (title: string, description: string, tags: string[], isPublic: boolean) => {
    setSaving(true);
    try {
      const saved = await saveShader(
        { ...project, title, description, tags, isPublic },
        project.id || undefined
      );
      addSavedProject(saved);
      setShowSaveModal(false);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (project.id) {
      const url = `${window.location.origin}/shader/${project.id}`;
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const hasErrors = Object.keys(editor.errors).length > 0;

  return (
    <>
      <header className="h-12 bg-forge-bg2 border-b border-forge-border flex items-center px-4 gap-4 flex-shrink-0 z-50">
        {/* Sidebar toggle + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="text-forge-text2 hover:text-forge-text transition-colors text-sm"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <div className="font-sans font-extrabold text-lg tracking-tight bg-gradient-to-r from-forge-accent to-forge-accent2 bg-clip-text text-transparent select-none">
            GLSL Forge
          </div>
        </div>

        {/* Project title */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-forge-text text-sm font-medium truncate max-w-48">
            {project.title}
          </span>
          {editor.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-forge-amber flex-shrink-0" title="Unsaved changes" />
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 ml-1">
          {hasErrors ? (
            <StatusPill color="red">Error</StatusPill>
          ) : (
            <StatusPill color="green">OK</StatusPill>
          )}
          <StatusPill color="purple">{project.buffers.length} {project.buffers.length === 1 ? 'pass' : 'passes'}</StatusPill>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {ui.isRecording && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-2 h-2 rounded-full bg-forge-red animate-pulse" />
              <span className="text-forge-red text-xs font-mono">REC</span>
            </div>
          )}

          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-xs"
            title="Import from Shadertoy"
          >
            Import
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            className="btn-secondary text-xs"
          >
            Save
          </button>

          {project.id && (
            <button onClick={handleShare} className="btn-secondary text-xs">
              Share
            </button>
          )}

          <button
            onClick={() => setRunning(!isRunning)}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-semibold transition-all font-sans',
              isRunning
                ? 'bg-forge-bg4 border border-forge-border2 text-forge-text2 hover:text-forge-text'
                : 'bg-gradient-to-r from-forge-accent to-forge-accent2 text-white hover:opacity-90'
            )}
          >
            {isRunning ? '⏸ Pause' : '▶ Run'}
          </button>
        </div>
      </header>

      {showSaveModal && (
        <SaveModal
          project={project}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </>
  );
}

function StatusPill({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-forge-green/10  text-forge-green  border-forge-green/20',
    red:    'bg-forge-red/10   text-forge-red    border-forge-red/20',
    amber:  'bg-forge-amber/10 text-forge-amber  border-forge-amber/20',
    purple: 'bg-forge-accent/10 text-forge-accent border-forge-accent/20',
  };
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-mono border', colors[color])}>
      {children}
    </span>
  );
}
