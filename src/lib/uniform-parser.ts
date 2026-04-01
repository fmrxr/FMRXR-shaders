import type { UniformDef, UniformType } from '@/types';

const BUILTIN_UNIFORMS = new Set([
  'iTime', 'iResolution', 'iMouse', 'iFrame',
  'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3',
  'iTimeDelta', 'iDate', 'iSampleRate',
]);

const TYPE_DEFAULTS: Record<string, UniformDef['value']> = {
  float: 0.5,
  vec2:  [0.5, 0.5],
  vec3:  [0.5, 0.5, 0.5],
  vec4:  [0.5, 0.5, 0.5, 1.0],
  bool:  false,
  int:   0,
};

/**
 * Parses GLSL source code and extracts uniform definitions with optional
 * annotation comments like:
 *   // @label Speed  @min 0.0  @max 5.0  @step 0.01
 *   uniform float u_speed;
 */
export function parseUniforms(glsl: string): UniformDef[] {
  const lines = glsl.split('\n');
  const result: UniformDef[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match uniform declaration
    const match = line.match(
      /^uniform\s+(float|vec2|vec3|vec4|bool|int)\s+(\w+)\s*;/
    );
    if (!match) continue;

    const type = match[1] as UniformType;
    const name = match[2];

    if (BUILTIN_UNIFORMS.has(name)) continue;
    if (name.startsWith('iChannel')) continue;

    // Look back up to 4 lines for annotation comments
    const context = lines.slice(Math.max(0, i - 4), i).join(' ');
    const annotations = parseAnnotations(context);

    // Infer color type from name
    const resolvedType: UniformType =
      (type === 'vec3' || type === 'vec4') &&
      (name.toLowerCase().includes('color') || name.toLowerCase().includes('col'))
        ? 'color'
        : type;

    const def: UniformDef = {
      name,
      type: resolvedType,
      value: TYPE_DEFAULTS[type] ?? 0,
      min:   annotations.min,
      max:   annotations.max,
      step:  annotations.step,
      label: annotations.label ?? formatLabel(name),
    };

    // Apply sensible defaults based on type
    if (def.min === undefined) def.min = type === 'int' ? 0 : 0.0;
    if (def.max === undefined) def.max = type === 'int' ? 10 : 1.0;
    if (def.step === undefined) {
      def.step = type === 'int' ? 1 : (def.max - def.min) / 200;
    }

    // Set default value to midpoint
    if (type === 'float' || type === 'int') {
      def.value = (def.min + def.max) / 2;
    }

    result.push(def);
  }

  return result;
}

function parseAnnotations(text: string): {
  min?: number;
  max?: number;
  step?: number;
  label?: string;
} {
  const result: { min?: number; max?: number; step?: number; label?: string } = {};

  const minM   = text.match(/@min\s+([\d.\-]+)/);
  const maxM   = text.match(/@max\s+([\d.\-]+)/);
  const stepM  = text.match(/@step\s+([\d.\-]+)/);
  const labelM = text.match(/@label\s+([^\@]+?)(?:\s+@|\s*$)/);

  if (minM)   result.min   = parseFloat(minM[1]);
  if (maxM)   result.max   = parseFloat(maxM[1]);
  if (stepM)  result.step  = parseFloat(stepM[1]);
  if (labelM) result.label = labelM[1].trim();

  return result;
}

function formatLabel(name: string): string {
  // Remove u_ or r_ prefix and convert camelCase/snake_case to Title Case
  return name
    .replace(/^[u|r|v]_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse GLSL compile errors into structured format
 */
export function parseGLSLErrors(errorLog: string): Array<{
  line: number;
  message: string;
  severity: 'error' | 'warning';
}> {
  const errors: Array<{ line: number; message: string; severity: 'error' | 'warning' }> = [];
  const lines = errorLog.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Format: ERROR: 0:LINE: message
    const match = line.match(/^(ERROR|WARNING):\s*\d+:(\d+):\s*(.+)$/i);
    if (match) {
      errors.push({
        line: parseInt(match[2], 10),
        message: match[3].trim(),
        severity: match[1].toLowerCase() as 'error' | 'warning',
      });
      continue;
    }

    // Some drivers use: 0(LINE) : error
    const match2 = line.match(/^\d+\((\d+)\)\s*:\s*(error|warning)\s*(.+)$/i);
    if (match2) {
      errors.push({
        line: parseInt(match2[1], 10),
        message: match2[3].trim(),
        severity: match2[2].toLowerCase() as 'error' | 'warning',
      });
    }
  }

  return errors;
}
