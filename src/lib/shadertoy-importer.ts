/**
 * Shadertoy import utilities.
 * Pure functions — no side effects, no WebGL.
 *
 * Parses Shadertoy page HTML (server-side scraped) and converts
 * the embedded shader JSON into a GLSLForge ShaderProject.
 */

import type { ShaderProject, ShaderBuffer } from '@/types';
import { parseUniforms } from './uniform-parser';

// ─── Raw Shadertoy types ──────────────────────────────────────────────

export interface ShadertoyInput {
  id: number;
  src: string;
  ctype: 'texture' | 'cubemap' | 'buffer' | 'video' | 'music' | 'musicstream' | 'webcam' | 'keyboard' | 'mic';
  channel: number;
  sampler?: {
    filter: string;
    wrap: string;
    vflip: string;
  };
}

export interface ShadertoyPass {
  inputs: ShadertoyInput[];
  outputs: Array<{ id: number; channel: number }>;
  code: string;
  name: string;
  description: string;
  type: 'image' | 'buffer' | 'sound' | 'common' | 'cubemap';
}

export interface ShadertoyInfo {
  id: string;
  name: string;
  username: string;
  description: string;
  tags: string[];
  published: number;
}

export interface ShadertoyRawData {
  info: ShadertoyInfo;
  renderpass: ShadertoyPass[];
}

export interface ImportWarning {
  channel: number;
  bufferId: string;
  ctype: string;
  message: string;
}

export interface ImportResult {
  project: ShaderProject;
  warnings: ImportWarning[];
  hasSoundPass: boolean;
}

// ─── ID extraction ────────────────────────────────────────────────────

export function extractShadertoyId(input: string): string {
  // Handle full URLs: https://www.shadertoy.com/view/XXXXX or #XXXXX fragment
  const urlMatch = input.match(/shadertoy\.com\/view\/([A-Za-z0-9_]+)/);
  if (urlMatch) return urlMatch[1];

  // Bare ID (alphanumeric, 6-8 chars)
  const bareMatch = input.trim().match(/^[A-Za-z0-9_]{4,10}$/);
  if (bareMatch) return input.trim();

  throw new Error(`Cannot extract shader ID from: "${input}"`);
}

// ─── HTML parser ──────────────────────────────────────────────────────

/**
 * Extract a balanced JSON object starting at `start` in `str`.
 * Properly handles strings (skips { } inside quoted strings).
 */
function extractJsonObject(str: string, start: number): string {
  let i = start;
  let depth = 0;
  let inString = false;
  let escaped = false;

  while (i < str.length) {
    const ch = str[i];

    if (escaped) {
      escaped = false;
    } else if (ch === '\\' && inString) {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return str.slice(start, i + 1);
      }
    }
    i++;
  }

  throw new Error('Unmatched braces when parsing shader JSON');
}

export function parsePage(html: string): ShadertoyRawData {
  // Strip HTML comments to avoid false positives
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');

  // Try strategy 1: look for the shader data passed to ShaderToy constructor
  // Pattern: new ShaderToy({...}) or gShaderToy = new ShaderToy({...})
  const ctorIdx = stripped.indexOf('new ShaderToy(');
  if (ctorIdx !== -1) {
    const openBrace = stripped.indexOf('{', ctorIdx);
    if (openBrace !== -1) {
      try {
        const jsonStr = extractJsonObject(stripped, openBrace);
        const data = JSON.parse(jsonStr) as Record<string, unknown>;
        const shader = (data.Shader as ShadertoyRawData) ?? (data as unknown as ShadertoyRawData);
        if (Array.isArray(shader.renderpass) && shader.renderpass.length > 0) {
          return shader;
        }
      } catch {
        // fall through to strategy 2
      }
    }
  }

  // Strategy 2: scan all <script> tags for renderpass
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(stripped)) !== null) {
    const content = match[1];
    if (!content.includes('"renderpass"')) continue;

    const rpIdx = content.indexOf('"renderpass"');
    // Search for the { that starts the object containing renderpass
    // Walk backwards through the content before renderpass
    let objStart = -1;
    let depth = 0;
    for (let i = rpIdx - 1; i >= 0; i--) {
      if (content[i] === '}') depth++;
      else if (content[i] === '{') {
        if (depth === 0) { objStart = i; break; }
        depth--;
      }
    }

    if (objStart === -1) continue;

    try {
      const jsonStr = extractJsonObject(content, objStart);
      const data = JSON.parse(jsonStr) as Record<string, unknown>;
      const shader = (data.Shader as ShadertoyRawData) ?? (data as unknown as ShadertoyRawData);
      if (Array.isArray(shader.renderpass) && shader.renderpass.length > 0) {
        return shader;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'Shader data not found in page. The shader may be private, or require login to view. ' +
    'Only public shaders can be imported.'
  );
}

// ─── Pass → buffer mapping ───────────────────────────────────────────

const BUFFER_IDS = ['bufA', 'bufB', 'bufC', 'bufD'] as const;

/** Map Shadertoy pass output id → GLSLForge buffer id */
function buildOutputMap(passes: ShadertoyPass[]): Map<number, string> {
  const map = new Map<number, string>();
  let bufIdx = 0;

  for (const pass of passes) {
    if (pass.type === 'image') {
      for (const out of pass.outputs) map.set(out.id, 'image');
    } else if (pass.type === 'buffer') {
      const bufId = BUFFER_IDS[bufIdx++] ?? `buf${bufIdx}`;
      for (const out of pass.outputs) map.set(out.id, bufId);
    }
  }

  return map;
}

/** Build channel array for a pass, collecting warnings for unsupported types */
function buildChannels(
  inputs: ShadertoyInput[],
  outputMap: Map<number, string>,
  passId: string,
  warnings: ImportWarning[]
): (string | null)[] {
  const channels: (string | null)[] = [null, null, null, null];

  for (const input of inputs) {
    const idx = input.channel;
    if (idx < 0 || idx > 3) continue;

    switch (input.ctype) {
      case 'texture':
      case 'cubemap': {
        // Proxy through our media route to bypass CORS
        const src = input.src.startsWith('http') ? new URL(input.src).pathname : input.src;
        channels[idx] = `/api/proxy-media?src=${encodeURIComponent(src)}`;
        break;
      }
      case 'buffer': {
        const bufId = outputMap.get(input.id);
        if (bufId) channels[idx] = bufId;
        break;
      }
      case 'video':
      case 'music':
      case 'musicstream':
      case 'mic': {
        // Audio input — channel left null; AudioEngine will fill it in Phase 2
        warnings.push({
          channel: idx,
          bufferId: passId,
          ctype: input.ctype,
          message: `iChannel${idx}: ${input.ctype} — connect an audio source in the Audio panel`,
        });
        break;
      }
      default:
        warnings.push({
          channel: idx,
          bufferId: passId,
          ctype: input.ctype,
          message: `iChannel${idx}: unsupported type "${input.ctype}" — left unbound`,
        });
    }
  }

  return channels;
}

// ─── Code adaptation ─────────────────────────────────────────────────

/**
 * Prepend optional common-pass code to a shader.
 * The engine handles mainImage → void main() wrapping automatically.
 */
export function wrapCode(code: string, commonCode?: string): string {
  if (commonCode?.trim()) {
    return commonCode + '\n\n' + code;
  }
  return code;
}

// ─── Main conversion ─────────────────────────────────────────────────

export function adaptToProject(raw: ShadertoyRawData): ImportResult {
  const warnings: ImportWarning[] = [];
  let hasSoundPass = false;

  // Extract common pass code
  const commonPass = raw.renderpass.find(p => p.type === 'common');
  const commonCode = commonPass?.code ?? '';

  // Build output id → buffer id map
  const outputMap = buildOutputMap(raw.renderpass);

  // Order: buffer passes first, then image
  const bufferPasses = raw.renderpass.filter(p => p.type === 'buffer');
  const imagePass    = raw.renderpass.find(p => p.type === 'image');
  const soundPass    = raw.renderpass.find(p => p.type === 'sound');

  if (soundPass) hasSoundPass = true;

  const buffers: ShaderBuffer[] = [];

  // Buffer passes → bufA, bufB, ...
  bufferPasses.forEach((pass, i) => {
    const id = BUFFER_IDS[i] ?? `buf${i + 1}`;
    buffers.push({
      id,
      label: `Buffer ${String.fromCharCode(65 + i)}`,
      code: wrapCode(pass.code, commonCode),
      channels: buildChannels(pass.inputs, outputMap, id, warnings),
    });
  });

  // Image pass
  if (imagePass) {
    buffers.push({
      id: 'image',
      label: 'Image',
      code: wrapCode(imagePass.code, commonCode),
      channels: buildChannels(imagePass.inputs, outputMap, 'image', warnings),
    });
  } else {
    // Fallback: empty image buffer
    buffers.push({
      id: 'image',
      label: 'Image',
      code: 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}',
      channels: [null, null, null, null],
    });
  }

  // Sound pass attached as extra buffer (flagged for Phase 2 audio output)
  if (soundPass) {
    buffers.unshift({
      id: 'sound',
      label: 'Sound',
      code: soundPass.code,
      channels: [null, null, null, null],
    });
  }

  const imageCode = imagePass?.code ?? '';

  const project: ShaderProject = {
    id: '',
    title: raw.info?.name ?? 'Imported Shader',
    description: raw.info?.description ?? '',
    tags: raw.info?.tags ?? [],
    buffers,
    uniforms: parseUniforms(imageCode),
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { project, warnings, hasSoundPass };
}
