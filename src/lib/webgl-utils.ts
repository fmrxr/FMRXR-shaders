/**
 * Low-level WebGL2 utility helpers.
 * All functions are pure — they take a gl context and return WebGL objects or throw.
 */

export const FULLSCREEN_QUAD_VERTS = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
]);

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Legacy WebGL1 vertex shader for fallback
export const VERTEX_SHADER_SOURCE_LEGACY = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createShader(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  type: number,
  source: string
): { shader: WebGLShader } | { error: string } {
  const shader = gl.createShader(type);
  if (!shader) return { error: 'Failed to create shader object' };

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown compile error';
    gl.deleteShader(shader);
    return { error: log };
  }

  return { shader };
}

export function createProgram(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  vertSource: string,
  fragSource: string
): { program: WebGLProgram } | { error: string } {
  const vsResult = createShader(gl, gl.VERTEX_SHADER, vertSource);
  if ('error' in vsResult) return { error: 'Vertex shader: ' + vsResult.error };

  const fsResult = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  if ('error' in fsResult) {
    gl.deleteShader(vsResult.shader);
    return { error: fsResult.error };
  }

  const program = gl.createProgram();
  if (!program) return { error: 'Failed to create program' };

  gl.attachShader(program, vsResult.shader);
  gl.attachShader(program, fsResult.shader);
  gl.linkProgram(program);

  gl.deleteShader(vsResult.shader);
  gl.deleteShader(fsResult.shader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown link error';
    gl.deleteProgram(program);
    return { error: log };
  }

  return { program };
}

export function createQuadBuffer(
  gl: WebGL2RenderingContext | WebGLRenderingContext
): WebGLBuffer {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTS, gl.STATIC_DRAW);
  return buf;
}

export function createFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA32F,
    width, height, 0,
    gl.RGBA, gl.FLOAT, null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    // Fallback to RGBA8 if RGBA32F not supported
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { fbo, texture };
}

export function setUniform(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  value: number | number[] | boolean | Int32Array
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc === null) return;

  if (typeof value === 'boolean') {
    gl.uniform1i(loc, value ? 1 : 0);
  } else if (typeof value === 'number') {
    gl.uniform1f(loc, value);
  } else if (Array.isArray(value)) {
    switch (value.length) {
      case 1: gl.uniform1f(loc, value[0]); break;
      case 2: gl.uniform2f(loc, value[0], value[1]); break;
      case 3: gl.uniform3f(loc, value[0], value[1], value[2]); break;
      case 4: gl.uniform4f(loc, value[0], value[1], value[2], value[3]); break;
    }
  }
}

export function setUniformInt(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  value: number
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc !== null) gl.uniform1i(loc, value);
}

export function bindVertexArray(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
  quadBuffer: WebGLBuffer
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const pos = gl.getAttribLocation(program, 'a_position');
  if (pos !== -1) {
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  }
}

export function detectWebGL2(canvas: HTMLCanvasElement): {
  gl: WebGL2RenderingContext | WebGLRenderingContext;
  isWebGL2: boolean;
} {
  const gl2 = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: true, // needed for export
    powerPreference: 'high-performance',
  });

  if (gl2) return { gl: gl2, isWebGL2: true };

  const gl1 = canvas.getContext('webgl', {
    antialias: false,
    preserveDrawingBuffer: true,
  }) ?? canvas.getContext('experimental-webgl', {
    antialias: false,
    preserveDrawingBuffer: true,
  });

  if (gl1) return { gl: gl1 as WebGLRenderingContext, isWebGL2: false };

  throw new Error('WebGL is not supported in this browser.');
}

export function setUniform1fv(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  values: number[]
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc !== null) gl.uniform1fv(loc, new Float32Array(values));
}

export function setUniform3fv(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  values: number[]
): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc !== null) gl.uniform3fv(loc, new Float32Array(values));
}

export async function loadTextureFromUrl(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  url: string
): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = gl.createTexture();
      if (!tex) { reject(new Error('Failed to create texture')); return; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      resolve(tex);
    };
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    img.src = url;
  });
}

/**
 * Inject Shadertoy-compatible precision + built-in declarations
 * into user GLSL if they don't already exist.
 */
export function preprocessGLSL(source: string, isWebGL2: boolean): string {
  const hasPrecision = /precision\s+\w+\s+float/.test(source);
  const hasVersion   = /^\s*#version/.test(source);

  let header = '';
  if (isWebGL2 && !hasVersion) {
    header += '#version 300 es\n';
  }
  if (!hasPrecision) {
    header += 'precision highp float;\n';
    if (isWebGL2) header += 'precision highp int;\n';
  }

  // Ensure out variable for WebGL2
  if (isWebGL2 && !source.includes('out vec4') && !source.includes('gl_FragColor')) {
    header += 'out vec4 fragColor;\n';
    // Alias gl_FragColor → fragColor for compatibility
    source = source.replace(/gl_FragColor/g, 'fragColor');
  }

  return header + source;
}
