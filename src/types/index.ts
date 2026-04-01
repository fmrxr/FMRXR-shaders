// ─── Core Shader Types ──────────────────────────────────────────────
export type UniformType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool' | 'int' | 'color';

export interface UniformDef {
  name: string;
  type: UniformType;
  value: number | [number, number] | [number, number, number] | [number, number, number, number] | boolean;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export interface ShaderBuffer {
  id: string;          // 'image' | 'bufA' | 'bufB' | 'bufC' | 'bufD'
  label: string;
  code: string;
  channels: (string | null)[];  // iChannel0–3 → buffer id or texture url
}

export interface ShaderProject {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  buffers: ShaderBuffer[];
  uniforms: UniformDef[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  thumbnail?: string;
}

// ─── Renderer Types ─────────────────────────────────────────────────
export interface RendererState {
  isRunning: boolean;
  startTime: number;
  pausedElapsed: number;
  frame: number;
  fps: number;
  resolution: [number, number];
  quality: number;
  mouse: [number, number, number, number]; // x, y, clickX, clickY
}

export interface CompiledPass {
  bufferId: string;
  program: WebGLProgram;
  fbo: WebGLFramebuffer | null;
  texture: WebGLTexture | null;
  pingPong: [WebGLFramebuffer, WebGLTexture] | null; // for feedback
}

export interface CompileResult {
  success: boolean;
  program?: WebGLProgram;
  error?: string;
  warnings?: string[];
}

// ─── Editor Types ────────────────────────────────────────────────────
export interface EditorTab {
  id: string;
  label: string;
  bufferId: string;
  isDirty: boolean;
}

export interface ParsedError {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

// ─── Export Types ────────────────────────────────────────────────────
export type ExportPreset = '1:1' | '9:16' | '16:9' | '4:5' | 'custom';
export type ExportFormat = 'png' | 'webm' | 'gif';

export interface ExportConfig {
  preset: ExportPreset;
  width: number;
  height: number;
  duration: number;    // seconds
  fps: number;
  quality: number;     // 0–1
  format: ExportFormat;
}

// ─── API Types ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface SaveShaderPayload {
  project: Omit<ShaderProject, 'id' | 'createdAt' | 'updatedAt'>;
  id?: string;
}
