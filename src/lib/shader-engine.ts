/**
 * ShaderEngine — Core WebGL2 multi-pass rendering engine.
 *
 * Manages:
 * - Program compilation per buffer
 * - Framebuffer chain (Buffer A/B/C/D → Image)
 * - Ping-pong textures for feedback loops
 * - Uniform binding (built-ins + custom)
 * - RAF render loop
 */

import type { ShaderBuffer, UniformDef } from '@/types';
import {
  createProgram,
  createQuadBuffer,
  createFramebuffer,
  setUniform,
  setUniformInt,
  bindVertexArray,
  detectWebGL2,
  VERTEX_SHADER_SOURCE,
  VERTEX_SHADER_SOURCE_LEGACY,
} from './webgl-utils';

export interface EngineCallbacks {
  onFpsUpdate: (fps: number) => void;
  onFrameUpdate: (frame: number, time: number) => void;
  onError: (bufferId: string, error: string) => void;
  onCompileSuccess: (bufferId: string) => void;
}

interface PassState {
  bufferId: string;
  program: WebGLProgram;
  // ping-pong pair for feedback
  fbo:  [WebGLFramebuffer, WebGLFramebuffer] | null;
  tex:  [WebGLTexture,     WebGLTexture]     | null;
  ping: number; // 0 or 1 — which side we write to this frame
}

export class ShaderEngine {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private isWebGL2: boolean;
  private quadBuf: WebGLBuffer;
  private passes: Map<string, PassState> = new Map();
  private bufferOrder: string[] = []; // render order, last = image
  private uniforms: Map<string, UniformDef> = new Map();
  private callbacks: EngineCallbacks;

  // Timing
  private startTime = 0;
  private pausedElapsed = 0;
  private isRunning = false;
  private rafId: number | null = null;
  private frameCount = 0;

  // FPS tracking
  private fpsSamples: number[] = [];
  private lastFrameTime = 0;

  // Mouse state
  private mouse = [0, 0, 0, 0];

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const { gl, isWebGL2 } = detectWebGL2(canvas);
    this.gl = gl;
    this.isWebGL2 = isWebGL2;
    this.quadBuf = createQuadBuffer(gl);
    this.callbacks = callbacks;
    this.startTime = performance.now();
  }

  get webgl2(): boolean { return this.isWebGL2; }
  get context(): WebGL2RenderingContext | WebGLRenderingContext { return this.gl; }
  get canvas(): HTMLCanvasElement { return this.gl.canvas as HTMLCanvasElement; }
  get elapsed(): number {
    if (this.isRunning) {
      return this.pausedElapsed + (performance.now() - this.startTime) / 1000;
    }
    return this.pausedElapsed;
  }

  // ─── Compilation ───────────────────────────────────────────────────

  compileBuffer(buffer: ShaderBuffer): boolean {
    const gl = this.gl;
    const vertSrc = this.isWebGL2 ? VERTEX_SHADER_SOURCE : VERTEX_SHADER_SOURCE_LEGACY;

    // Preprocess: handle gl_FragColor → out var for WebGL2
    let fragSrc = buffer.code;
    if (this.isWebGL2) {
      if (!fragSrc.includes('#version')) {
        fragSrc = '#version 300 es\n' + fragSrc;
      }
      if (!fragSrc.includes('out vec4') && fragSrc.includes('gl_FragColor')) {
        fragSrc = fragSrc.replace(
          /void\s+main\s*\(\s*\)/,
          'out vec4 fragColor;\nvoid main()'
        );
        fragSrc = fragSrc.replace(/gl_FragColor/g, 'fragColor');
      }
    }

    const result = createProgram(gl, vertSrc, fragSrc);
    if ('error' in result) {
      this.callbacks.onError(buffer.id, result.error);
      return false;
    }

    // Delete old program if exists
    const existing = this.passes.get(buffer.id);
    if (existing) {
      gl.deleteProgram(existing.program);
      // Keep fbo/tex to avoid flicker
    }

    const isImage = buffer.id === 'image';
    let fbo: PassState['fbo'] = null;
    let tex: PassState['tex'] = null;

    if (!isImage) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const a = createFramebuffer(gl as WebGL2RenderingContext, w, h);
      const b = createFramebuffer(gl as WebGL2RenderingContext, w, h);
      fbo = [a.fbo, b.fbo];
      tex = [a.texture, b.texture];
    }

    const prev = this.passes.get(buffer.id);
    this.passes.set(buffer.id, {
      bufferId: buffer.id,
      program: result.program,
      fbo: fbo ?? prev?.fbo ?? null,
      tex: tex ?? prev?.tex ?? null,
      ping: prev?.ping ?? 0,
    });

    this.callbacks.onCompileSuccess(buffer.id);
    return true;
  }

  setBufferOrder(order: string[]): void {
    this.bufferOrder = order;
  }

  setUniformDefs(defs: UniformDef[]): void {
    this.uniforms.clear();
    for (const d of defs) this.uniforms.set(d.name, d);
  }

  updateUniform(name: string, value: UniformDef['value']): void {
    const existing = this.uniforms.get(name);
    if (existing) {
      this.uniforms.set(name, { ...existing, value });
    }
  }

  // ─── Render loop ───────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.startTime = performance.now();
    this.isRunning = true;
    this.tick();
  }

  pause(): void {
    if (!this.isRunning) return;
    this.pausedElapsed += (performance.now() - this.startTime) / 1000;
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset(): void {
    this.pausedElapsed = 0;
    this.startTime = performance.now();
    this.frameCount = 0;
  }

  setMouse(x: number, y: number, clicking = false): void {
    this.mouse[0] = x;
    this.mouse[1] = y;
    if (clicking) {
      this.mouse[2] = x;
      this.mouse[3] = y;
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    this.rafId = requestAnimationFrame(this.tick);
    this.renderFrame();
  };

  renderFrame(): void {
    const gl = this.gl;
    const t = this.elapsed;

    // Render each buffer in order
    for (const bufferId of this.bufferOrder) {
      const pass = this.passes.get(bufferId);
      if (!pass) continue;

      const isImage = bufferId === 'image';

      if (!isImage && pass.fbo) {
        const writeIdx = pass.ping;
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fbo[writeIdx]);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(pass.program);
      bindVertexArray(gl, pass.program, this.quadBuf);

      // Built-in uniforms
      setUniform(gl, pass.program, 'iTime', t);
      setUniform(gl, pass.program, 'iResolution', [this.canvas.width, this.canvas.height]);
      setUniform(gl, pass.program, 'iMouse', this.mouse);
      setUniformInt(gl, pass.program, 'iFrame', this.frameCount);
      setUniform(gl, pass.program, 'iTimeDelta', this.lastFrameTime > 0 ? (performance.now() - this.lastFrameTime) / 1000 : 0.016);

      // Bind buffer textures to iChannel slots
      this.bindChannels(pass, this.bufferOrder);

      // Custom uniforms
      for (const [name, def] of this.uniforms) {
        const v = def.value;
        if (typeof v === 'boolean') {
          setUniformInt(gl, pass.program, name, v ? 1 : 0);
        } else if (typeof v === 'number') {
          setUniform(gl, pass.program, name, v);
        } else {
          setUniform(gl, pass.program, name, v as number[]);
        }
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Flip ping-pong
      if (!isImage && pass.fbo) {
        pass.ping = 1 - pass.ping;
      }
    }

    // Update stats
    const now = performance.now();
    const delta = now - (this.lastFrameTime || now);
    this.lastFrameTime = now;
    if (delta > 0) {
      this.fpsSamples.push(1000 / delta);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const fps = Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length);
      this.callbacks.onFpsUpdate(fps);
    }

    this.frameCount++;
    this.callbacks.onFrameUpdate(this.frameCount, t);
  }

  private bindChannels(pass: PassState, bufferOrder: string[]): void {
    const gl = this.gl;
    // Default: bind previous buffers in order to iChannel0, iChannel1...
    const otherBuffers = bufferOrder.filter(id => id !== pass.bufferId && id !== 'image');

    for (let i = 0; i < 4; i++) {
      const loc = gl.getUniformLocation(pass.program, `iChannel${i}`);
      if (loc === null) continue;

      gl.activeTexture(gl.TEXTURE0 + i);
      const srcId = otherBuffers[i];
      const src = srcId ? this.passes.get(srcId) : undefined;

      if (src?.tex) {
        const readIdx = 1 - src.ping; // read from the side we just finished writing
        gl.bindTexture(gl.TEXTURE_2D, src.tex[readIdx]);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.uniform1i(loc, i);
    }
  }

  // ─── Resize ────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    const gl = this.gl as WebGL2RenderingContext;
    // Recreate framebuffers at new size
    for (const [id, pass] of this.passes) {
      if (id === 'image') continue;
      if (pass.fbo) {
        gl.deleteFramebuffer(pass.fbo[0]);
        gl.deleteFramebuffer(pass.fbo[1]);
        gl.deleteTexture(pass.tex![0]);
        gl.deleteTexture(pass.tex![1]);
        const a = createFramebuffer(gl, width, height);
        const b = createFramebuffer(gl, width, height);
        pass.fbo = [a.fbo, b.fbo];
        pass.tex = [a.texture, b.texture];
        pass.ping = 0;
      }
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this.pause();
    const gl = this.gl;
    for (const pass of this.passes.values()) {
      gl.deleteProgram(pass.program);
      if (pass.fbo) {
        gl.deleteFramebuffer(pass.fbo[0]);
        gl.deleteFramebuffer(pass.fbo[1]);
      }
      if (pass.tex) {
        gl.deleteTexture(pass.tex[0]);
        gl.deleteTexture(pass.tex[1]);
      }
    }
    this.passes.clear();
  }
}
