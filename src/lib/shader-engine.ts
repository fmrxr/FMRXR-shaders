/**
 * ShaderEngine — Core WebGL2 multi-pass rendering engine.
 *
 * Manages:
 * - Program compilation per buffer (Shadertoy mainImage auto-wrapped)
 * - Framebuffer chain (Buffer A/B/C/D → Image)
 * - Ping-pong textures for feedback loops
 * - Uniform binding (built-ins + custom)
 * - URL texture cache for imported channel assets
 * - Audio texture binding (Phase 2)
 * - Hand tracking data injection (Phase 3)
 * - RAF render loop
 */

import type { ShaderBuffer, UniformDef } from '@/types';
import type { HandData } from './hands-engine';
import {
  createProgram,
  createQuadBuffer,
  createFramebuffer,
  setUniform,
  setUniformInt,
  setUniform1fv,
  setUniform3fv,
  bindVertexArray,
  detectWebGL2,
  loadTextureFromUrl,
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
  fbo:  [WebGLFramebuffer, WebGLFramebuffer] | null;
  tex:  [WebGLTexture,     WebGLTexture]     | null;
  ping: number;
}

interface AudioChannel {
  tex: WebGLTexture;
  time: number;
  resolution: [number, number];
}

export class ShaderEngine {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private isWebGL2: boolean;
  private quadBuf: WebGLBuffer;
  private passes: Map<string, PassState> = new Map();
  private bufferOrder: string[] = [];
  private bufferDefs: ShaderBuffer[] = [];
  private uniforms: Map<string, UniformDef> = new Map();
  private callbacks: EngineCallbacks;

  // URL texture cache (for imported Shadertoy channels)
  private urlTextures: Map<string, WebGLTexture> = new Map();
  private urlTextureResolutions: Map<string, [number, number]> = new Map();

  // Audio channels (Phase 2)
  private audioChannels: Map<number, AudioChannel> = new Map();

  // Hand tracking (Phase 3)
  private handData: HandData | null = null;
  private handsEnabled = false;

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

    let fragSrc = buffer.code;

    if (this.isWebGL2) {
      if (!fragSrc.includes('#version')) {
        fragSrc = '#version 300 es\n' + fragSrc;
      }

      // Auto-wrap Shadertoy mainImage shaders
      if (fragSrc.includes('void mainImage') && !fragSrc.includes('void main(')) {
        fragSrc += '\nout vec4 fragColor;\nvoid main() { mainImage(fragColor, gl_FragCoord.xy); }';
      } else if (!fragSrc.includes('out vec4') && fragSrc.includes('gl_FragColor')) {
        fragSrc = fragSrc.replace(
          /void\s+main\s*\(\s*\)/,
          'out vec4 fragColor;\nvoid main()'
        );
        fragSrc = fragSrc.replace(/gl_FragColor/g, 'fragColor');
      }
    } else {
      // WebGL1: wrap mainImage shaders
      if (fragSrc.includes('void mainImage') && !fragSrc.includes('void main(')) {
        fragSrc += '\nvoid main() { mainImage(gl_FragColor, gl_FragCoord.xy); }';
      }
    }

    const result = createProgram(gl, vertSrc, fragSrc);
    if ('error' in result) {
      this.callbacks.onError(buffer.id, result.error);
      return false;
    }

    const existing = this.passes.get(buffer.id);
    if (existing) {
      gl.deleteProgram(existing.program);
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

  setBufferDefs(buffers: ShaderBuffer[]): void {
    this.bufferDefs = buffers;
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

  // ─── URL Texture cache ─────────────────────────────────────────────

  async loadChannelTextures(buffers: ShaderBuffer[]): Promise<void> {
    for (const buffer of buffers) {
      for (const channel of buffer.channels) {
        if (typeof channel === 'string' && channel.startsWith('/api/proxy-media')) {
          if (!this.urlTextures.has(channel)) {
            try {
              const tex = await loadTextureFromUrl(this.gl, channel);
              this.urlTextures.set(channel, tex);
              // Store resolution from image element dimensions
              const img = new Image();
              img.src = channel;
              await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
              this.urlTextureResolutions.set(channel, [img.naturalWidth || 1024, img.naturalHeight || 1024]);
            } catch (e) {
              console.warn('Failed to load channel texture:', channel, e);
            }
          }
        }
      }
    }
  }

  // ─── Audio (Phase 2) ──────────────────────────────────────────────

  setAudioChannel(channelIndex: number, data: AudioChannel | null): void {
    if (data) {
      this.audioChannels.set(channelIndex, data);
    } else {
      const existing = this.audioChannels.get(channelIndex);
      if (existing) {
        this.gl.deleteTexture(existing.tex);
        this.audioChannels.delete(channelIndex);
      }
    }
  }

  // ─── Hand tracking (Phase 3) ──────────────────────────────────────

  setHandData(data: HandData | null): void {
    this.handData = data;
  }

  setHandsEnabled(enabled: boolean): void {
    this.handsEnabled = enabled;
    if (!enabled) this.handData = null;
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
    const now = performance.now();
    const deltaMs = this.lastFrameTime > 0 ? (now - this.lastFrameTime) : 16.667;
    const frameRate = Math.min(120, Math.max(1, 1000 / deltaMs));

    const date = new Date();
    const iDate = [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000,
    ];

    // Channel times from audio
    const channelTimes = [0, 0, 0, 0];
    const channelResolutions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 4 × vec3

    for (const [idx, ach] of this.audioChannels) {
      if (idx < 4) {
        channelTimes[idx] = ach.time;
        channelResolutions[idx * 3]     = ach.resolution[0];
        channelResolutions[idx * 3 + 1] = ach.resolution[1];
        channelResolutions[idx * 3 + 2] = 0;
      }
    }

    // Effective mouse: hand tracking overrides pointer if hands enabled
    let effectiveMouse = this.mouse;
    if (this.handsEnabled && this.handData) {
      const hx = this.handData.pos[0] * this.canvas.width;
      const hy = this.handData.pos[1] * this.canvas.height;
      const isPinching = this.handData.pinchStrength > 0.7;
      effectiveMouse = [hx, hy, isPinching ? hx : 0, isPinching ? hy : 0];
    }

    for (const bufferId of this.bufferOrder) {
      const pass = this.passes.get(bufferId);
      if (!pass) continue;

      const isImage = bufferId === 'image';

      if (!isImage && pass.fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fbo[pass.ping]);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(pass.program);
      bindVertexArray(gl, pass.program, this.quadBuf);

      // ── Built-in uniforms ──
      setUniform(gl, pass.program, 'iTime', t);
      setUniform(gl, pass.program, 'iResolution', [this.canvas.width, this.canvas.height, 1.0]);
      setUniform(gl, pass.program, 'iMouse', effectiveMouse);
      setUniformInt(gl, pass.program, 'iFrame', this.frameCount);
      setUniform(gl, pass.program, 'iTimeDelta', deltaMs / 1000);
      setUniform(gl, pass.program, 'iFrameRate', frameRate);
      setUniform(gl, pass.program, 'iDate', iDate);
      setUniform(gl, pass.program, 'iSampleRate', 44100.0);
      setUniform1fv(gl, pass.program, 'iChannelTime', channelTimes);
      setUniform3fv(gl, pass.program, 'iChannelResolution', channelResolutions);

      // ── Hand uniforms (Phase 3) ──
      if (this.handsEnabled && this.handData) {
        setUniform(gl, pass.program, 'uHandPos', this.handData.pos);
        setUniform(gl, pass.program, 'uPinchStrength', this.handData.pinchStrength);
        setUniform(gl, pass.program, 'uHandOpen', this.handData.handOpen);
        setUniform(gl, pass.program, 'uWrist', this.handData.wrist);
      } else if (this.handsEnabled) {
        setUniform(gl, pass.program, 'uHandPos', [0, 0]);
        setUniform(gl, pass.program, 'uPinchStrength', 0);
        setUniform(gl, pass.program, 'uHandOpen', 0);
        setUniform(gl, pass.program, 'uWrist', [0, 0, 0]);
      }

      // ── Bind channels ──
      this.bindChannels(pass);

      // ── Custom uniforms ──
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

      if (!isImage && pass.fbo) {
        pass.ping = 1 - pass.ping;
      }
    }

    this.lastFrameTime = now;
    if (deltaMs > 0) {
      this.fpsSamples.push(1000 / deltaMs);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const fps = Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length);
      this.callbacks.onFpsUpdate(fps);
    }

    this.frameCount++;
    this.callbacks.onFrameUpdate(this.frameCount, t);
  }

  private bindChannels(pass: PassState): void {
    const gl = this.gl;
    const bufDef = this.bufferDefs.find(b => b.id === pass.bufferId);

    for (let i = 0; i < 4; i++) {
      const loc = gl.getUniformLocation(pass.program, `iChannel${i}`);
      if (loc === null) continue;

      gl.activeTexture(gl.TEXTURE0 + i);

      const channelVal = bufDef?.channels[i];

      // Audio channel overrides
      const audioCh = this.audioChannels.get(i);
      if (audioCh) {
        gl.bindTexture(gl.TEXTURE_2D, audioCh.tex);
        gl.uniform1i(loc, i);
        continue;
      }

      if (typeof channelVal === 'string' && channelVal.startsWith('/api/proxy-media')) {
        // URL texture
        const tex = this.urlTextures.get(channelVal) ?? null;
        gl.bindTexture(gl.TEXTURE_2D, tex);
      } else if (typeof channelVal === 'string') {
        // Buffer reference
        const src = this.passes.get(channelVal);
        if (src?.tex) {
          const readIdx = 1 - src.ping;
          gl.bindTexture(gl.TEXTURE_2D, src.tex[readIdx]);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      } else {
        // Legacy: default binding — bind previous buffers in order
        const otherBuffers = this.bufferOrder.filter(id => id !== pass.bufferId && id !== 'image');
        const srcId = otherBuffers[i];
        const src = srcId ? this.passes.get(srcId) : undefined;
        if (src?.tex) {
          gl.bindTexture(gl.TEXTURE_2D, src.tex[1 - src.ping]);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
      }

      gl.uniform1i(loc, i);
    }
  }

  // ─── Resize ────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    const gl = this.gl as WebGL2RenderingContext;
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
    for (const tex of this.urlTextures.values()) {
      gl.deleteTexture(tex);
    }
    for (const ach of this.audioChannels.values()) {
      gl.deleteTexture(ach.tex);
    }
    this.passes.clear();
    this.urlTextures.clear();
    this.audioChannels.clear();
  }
}
