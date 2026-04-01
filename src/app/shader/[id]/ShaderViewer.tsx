'use client';

import { useEffect, useRef } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { ShaderCanvas } from '@/components/renderer/ShaderCanvas';
import { UniformsPanel } from '@/components/panels/UniformsPanel';
import type { ShaderProject } from '@/types';
import Link from 'next/link';

interface ShaderViewerProps {
  project: ShaderProject;
}

export function ShaderViewer({ project }: ShaderViewerProps) {
  const { setProject } = useShaderStore();

  useEffect(() => {
    setProject(project);
  }, [project, setProject]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Minimal top bar */}
      <header className="h-12 bg-forge-bg2 border-b border-forge-border flex items-center px-4 gap-4 flex-shrink-0">
        <Link href="/" className="text-forge-text2 hover:text-forge-text transition-colors text-sm">
          ← GLSL Forge
        </Link>
        <span className="text-forge-text font-medium">{project.title}</span>
        <div className="flex gap-2 ml-2">
          {project.tags.map(t => (
            <span key={t} className="text-forge-text2/50 text-xs font-mono">{t}</span>
          ))}
        </div>
        <div className="flex-1" />
        <Link
          href="/"
          className="px-3 py-1.5 bg-gradient-to-r from-forge-accent to-forge-accent2 text-white text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
        >
          Open Editor
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <ShaderCanvas />
        </div>

        {/* Uniforms sidebar */}
        <div className="w-56 bg-forge-bg2 border-l border-forge-border overflow-y-auto">
          <div className="px-4 py-3 border-b border-forge-border">
            <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider">Controls</p>
          </div>
          <UniformsPanel />

          {/* Code preview */}
          {project.description && (
            <div className="px-4 py-3 border-t border-forge-border">
              <p className="text-forge-text2 text-xs font-mono leading-relaxed">
                {project.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
