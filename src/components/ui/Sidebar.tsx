'use client';

import { useState, useEffect } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { GLSL_TEMPLATES } from '@/lib/glsl-templates';
import { parseUniforms } from '@/lib/uniform-parser';
import type { ShaderProject, ShaderBuffer } from '@/types';
import { clsx } from 'clsx';

const BUILT_IN_SHADERS: Array<{ id: string; title: string; template: keyof typeof GLSL_TEMPLATES; tags: string[] }> = [
  { id: 'builtin-plasma',    title: 'Plasma Wave',     template: 'plasma',      tags: ['plasma', 'wave']      },
  { id: 'builtin-fractal',   title: 'Mandelbrot',      template: 'fractal',     tags: ['fractal', 'math']     },
  { id: 'builtin-raymarching', title: 'Raymarcher',    template: 'raymarching', tags: ['3d', 'sdf']           },
  { id: 'builtin-noise',     title: 'FBM Noise',       template: 'noise',       tags: ['noise', 'procedural'] },
  { id: 'builtin-reaction',  title: 'Reaction-Diffusion', template: 'reaction', tags: ['simulation', 'rd']    },
  { id: 'builtin-blank',     title: 'Blank',           template: 'blank',       tags: ['starter']             },
];

export function Sidebar() {
  const { ui, project, setProject, savedProjects } = useShaderStore();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState('builtin-plasma');

  const filtered = BUILT_IN_SHADERS.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.includes(search.toLowerCase()))
  );

  const savedFiltered = savedProjects.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.includes(search.toLowerCase()))
  );

  const loadBuiltIn = (item: typeof BUILT_IN_SHADERS[0]) => {
    setActiveId(item.id);
    const code = GLSL_TEMPLATES[item.template];
    const imageBuffer: ShaderBuffer = {
      id: 'image',
      label: 'Image',
      code,
      channels: [null, null, null, null],
    };
    const proj: ShaderProject = {
      id: item.id,
      title: item.title,
      description: '',
      tags: item.tags,
      buffers: [imageBuffer],
      uniforms: parseUniforms(code),
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProject(proj);
  };

  const loadSaved = (p: ShaderProject) => {
    setActiveId(p.id);
    setProject(p);
  };

  if (!ui.sidebarOpen) return null;

  return (
    <div className="w-52 flex-shrink-0 bg-forge-bg2 border-r border-forge-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-forge-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-forge-text2 text-xs font-mono uppercase tracking-wider">Shaders</span>
          <NewShaderButton />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-forge-bg3 border border-forge-border text-forge-text text-xs font-mono px-2.5 py-1.5 rounded-md outline-none focus:border-forge-accent/50 placeholder:text-forge-text2/40 transition-colors"
        />
      </div>

      {/* Shader list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Saved */}
        {savedFiltered.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-forge-text2/40 text-xs font-mono uppercase tracking-wider">
              Saved
            </div>
            {savedFiltered.map((p) => (
              <ShaderItem
                key={p.id}
                title={p.title}
                tags={p.tags}
                isActive={activeId === p.id}
                onClick={() => loadSaved(p)}
              />
            ))}
          </div>
        )}

        {/* Built-in */}
        <div>
          <div className="px-3 py-1 text-forge-text2/40 text-xs font-mono uppercase tracking-wider">
            Examples
          </div>
          {filtered.map((item) => (
            <ShaderItem
              key={item.id}
              title={item.title}
              tags={item.tags}
              isActive={activeId === item.id}
              onClick={() => loadBuiltIn(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShaderItem({
  title,
  tags,
  isActive,
  onClick,
}: {
  title: string;
  tags: string[];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2.5 transition-all border-l-2',
        isActive
          ? 'bg-forge-bg4 border-forge-accent text-forge-text'
          : 'border-transparent text-forge-text2 hover:bg-forge-bg3 hover:text-forge-text'
      )}
    >
      <div className="text-xs font-medium leading-tight">{title}</div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="text-forge-text2/50 text-xs font-mono"
          >
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function NewShaderButton() {
  const { setProject } = useShaderStore();

  const create = () => {
    const code = GLSL_TEMPLATES.blank;
    const imageBuffer: ShaderBuffer = {
      id: 'image', label: 'Image', code, channels: [null, null, null, null],
    };
    setProject({
      id: '',
      title: 'New Shader',
      description: '',
      tags: [],
      buffers: [imageBuffer],
      uniforms: parseUniforms(code),
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <button
      onClick={create}
      className="text-forge-text2 hover:text-forge-text text-lg leading-none transition-colors"
      title="New shader"
    >
      +
    </button>
  );
}
