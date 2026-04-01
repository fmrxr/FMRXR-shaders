import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ShaderProject, ShaderBuffer, UniformDef, ExportConfig } from '@/types';
import { GLSL_TEMPLATES, DEFAULT_BUFFER_CODE } from '@/lib/glsl-templates';
import { parseUniforms } from '@/lib/uniform-parser';

// ─── State shape ─────────────────────────────────────────────────────

interface RendererStats {
  fps: number;
  frame: number;
  time: number;
  resolution: [number, number];
}

interface EditorState {
  activeBufferId: string;
  isDirty: boolean;
  errors: Record<string, string>;  // bufferId → error message
  compiledBuffers: Set<string>;
}

interface UIState {
  sidebarOpen: boolean;
  rightPanelTab: 'uniforms' | 'buffers' | 'export' | 'info';
  exportConfig: ExportConfig;
  isRecording: boolean;
  isExporting: boolean;
  quality: number;  // 0.25 | 0.5 | 0.75 | 1.0
}

export interface ShaderStore {
  // Project
  project: ShaderProject;
  savedProjects: ShaderProject[];

  // Renderer
  isRunning: boolean;
  stats: RendererStats;

  // Editor
  editor: EditorState;

  // UI
  ui: UIState;

  // Actions — Project
  setProject: (project: ShaderProject) => void;
  updateBuffer: (bufferId: string, code: string) => void;
  addBuffer: () => void;
  removeBuffer: (bufferId: string) => void;
  setActiveBuffer: (bufferId: string) => void;
  updateUniform: (name: string, value: UniformDef['value']) => void;
  setUniforms: (uniforms: UniformDef[]) => void;
  setProjectMeta: (meta: Partial<Pick<ShaderProject, 'title' | 'description' | 'tags' | 'isPublic'>>) => void;

  // Actions — Renderer
  setRunning: (running: boolean) => void;
  updateStats: (stats: Partial<RendererStats>) => void;
  setError: (bufferId: string, error: string | null) => void;
  setCompiled: (bufferId: string) => void;

  // Actions — UI
  setQuality: (q: number) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  setRecording: (r: boolean) => void;
  setExporting: (e: boolean) => void;
  toggleSidebar: () => void;
  setRightPanelTab: (tab: UIState['rightPanelTab']) => void;

  // Actions — Library
  addSavedProject: (p: ShaderProject) => void;
  removeSavedProject: (id: string) => void;

  // Helpers
  activeBuffer: () => ShaderBuffer;
  activeCode: () => string;
}

// ─── Default project ─────────────────────────────────────────────────

function makeDefaultProject(): ShaderProject {
  const imageBuffer: ShaderBuffer = {
    id: 'image',
    label: 'Image',
    code: GLSL_TEMPLATES.plasma,
    channels: [null, null, null, null],
  };
  const bufA: ShaderBuffer = {
    id: 'bufA',
    label: 'Buffer A',
    code: DEFAULT_BUFFER_CODE,
    channels: ['image', null, null, null],
  };

  return {
    id: '',
    title: 'Plasma Wave',
    description: 'Classic plasma effect using sine functions',
    tags: ['plasma', 'wave', 'color'],
    buffers: [bufA, imageBuffer],
    uniforms: parseUniforms(GLSL_TEMPLATES.plasma),
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Store ────────────────────────────────────────────────────────────

export const useShaderStore = create<ShaderStore>()(
  immer((set, get) => ({
    project: makeDefaultProject(),
    savedProjects: [],

    isRunning: true,
    stats: { fps: 0, frame: 0, time: 0, resolution: [0, 0] },

    editor: {
      activeBufferId: 'image',
      isDirty: false,
      errors: {},
      compiledBuffers: new Set(),
    },

    ui: {
      sidebarOpen: true,
      rightPanelTab: 'uniforms',
      exportConfig: {
        preset: '1:1',
        width: 1080,
        height: 1080,
        duration: 8,
        fps: 30,
        quality: 0.9,
        format: 'webm',
      },
      isRecording: false,
      isExporting: false,
      quality: 1.0,
    },

    // ── Project actions ──

    setProject: (project) => set((s) => {
      s.project = project;
      s.editor.activeBufferId = project.buffers.find(b => b.id === 'image')?.id ?? project.buffers[0]?.id ?? 'image';
      s.editor.errors = {};
      s.editor.compiledBuffers = new Set();
      s.editor.isDirty = false;
    }),

    updateBuffer: (bufferId, code) => set((s) => {
      const buf = s.project.buffers.find(b => b.id === bufferId);
      if (buf) {
        buf.code = code;
        s.editor.isDirty = true;
        // Re-parse uniforms from image buffer only
        if (bufferId === 'image') {
          s.project.uniforms = parseUniforms(code);
        }
      }
    }),

    addBuffer: () => set((s) => {
      const labels = ['A', 'B', 'C', 'D'];
      const existing = s.project.buffers.filter(b => b.id !== 'image').length;
      const label = labels[existing] ?? String(existing + 1);
      const newBuf: ShaderBuffer = {
        id: 'buf' + label,
        label: 'Buffer ' + label,
        code: DEFAULT_BUFFER_CODE,
        channels: [null, null, null, null],
      };
      // Insert before image
      const imgIdx = s.project.buffers.findIndex(b => b.id === 'image');
      s.project.buffers.splice(imgIdx, 0, newBuf);
      s.editor.activeBufferId = newBuf.id;
    }),

    removeBuffer: (bufferId) => set((s) => {
      if (bufferId === 'image') return;
      s.project.buffers = s.project.buffers.filter(b => b.id !== bufferId);
      if (s.editor.activeBufferId === bufferId) {
        s.editor.activeBufferId = 'image';
      }
    }),

    setActiveBuffer: (bufferId) => set((s) => {
      s.editor.activeBufferId = bufferId;
    }),

    updateUniform: (name, value) => set((s) => {
      const u = s.project.uniforms.find(u => u.name === name);
      if (u) u.value = value;
    }),

    setUniforms: (uniforms) => set((s) => {
      s.project.uniforms = uniforms;
    }),

    setProjectMeta: (meta) => set((s) => {
      Object.assign(s.project, meta);
      s.editor.isDirty = true;
    }),

    // ── Renderer actions ──

    setRunning: (running) => set((s) => { s.isRunning = running; }),

    updateStats: (stats) => set((s) => {
      Object.assign(s.stats, stats);
    }),

    setError: (bufferId, error) => set((s) => {
      if (error === null) {
        delete s.editor.errors[bufferId];
      } else {
        s.editor.errors[bufferId] = error;
      }
    }),

    setCompiled: (bufferId) => set((s) => {
      s.editor.compiledBuffers.add(bufferId);
      delete s.editor.errors[bufferId];
    }),

    // ── UI actions ──

    setQuality: (q) => set((s) => { s.ui.quality = q; }),
    setExportConfig: (config) => set((s) => { Object.assign(s.ui.exportConfig, config); }),
    setRecording: (r) => set((s) => { s.ui.isRecording = r; }),
    setExporting: (e) => set((s) => { s.ui.isExporting = e; }),
    toggleSidebar: () => set((s) => { s.ui.sidebarOpen = !s.ui.sidebarOpen; }),
    setRightPanelTab: (tab) => set((s) => { s.ui.rightPanelTab = tab; }),

    // ── Library ──

    addSavedProject: (p) => set((s) => {
      const idx = s.savedProjects.findIndex(x => x.id === p.id);
      if (idx >= 0) s.savedProjects[idx] = p;
      else s.savedProjects.unshift(p);
    }),

    removeSavedProject: (id) => set((s) => {
      s.savedProjects = s.savedProjects.filter(p => p.id !== id);
    }),

    // ── Helpers ──

    activeBuffer: () => {
      const { project, editor } = get();
      return project.buffers.find(b => b.id === editor.activeBufferId) ?? project.buffers[0];
    },

    activeCode: () => {
      const { project, editor } = get();
      return project.buffers.find(b => b.id === editor.activeBufferId)?.code ?? '';
    },
  }))
);
