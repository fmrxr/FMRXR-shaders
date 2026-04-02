/**
 * AudioEngine — Web Audio API wrapper for shader audio integration.
 *
 * Two roles:
 *  1. INPUT  — mic or audio file → AnalyserNode → 512×2 WebGL texture per frame
 *              (row 0 = waveform/time-domain, row 1 = FFT/frequency)
 *  2. OUTPUT — render mainSound pass → AudioBuffer → AudioContext playback
 */

export interface AudioChannelData {
  /** 512×2 RGBA texture: row 0 = waveform, row 1 = FFT */
  tex: WebGLTexture;
  /** Current playback position in seconds */
  time: number;
  /** Always [512, 2] */
  resolution: [number, number];
}

// ─── Input engine ─────────────────────────────────────────────────────

export class AudioInputEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private tex: WebGLTexture | null = null;
  private pixelBuf: Uint8Array<ArrayBuffer> = new Uint8Array(512 * 2 * 4);
  private waveform: Uint8Array<ArrayBuffer> = new Uint8Array(512);
  private frequency: Uint8Array<ArrayBuffer> = new Uint8Array(512);

  get isActive(): boolean { return this.analyser !== null; }

  get currentTime(): number { return this.ctx?.currentTime ?? 0; }

  async startMic(): Promise<void> {
    await this.stop();
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.ctx.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    // Note: NOT connecting to destination — we don't want mic feedback
  }

  async startFile(file: File): Promise<void> {
    await this.stop();
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuf;
    source.loop = true;
    source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    source.start();
  }

  /**
   * Call once per frame. Updates the WebGL texture with current audio data.
   * Returns null if not active.
   */
  updateTexture(gl: WebGL2RenderingContext | WebGLRenderingContext): AudioChannelData | null {
    if (!this.analyser) return null;

    this.analyser.getByteTimeDomainData(this.waveform);
    this.analyser.getByteFrequencyData(this.frequency);

    // Pack into 512×2 RGBA pixel buffer
    for (let i = 0; i < 512; i++) {
      // Row 0: waveform (time domain), grayscale
      this.pixelBuf[i * 4]     = this.waveform[i];
      this.pixelBuf[i * 4 + 1] = this.waveform[i];
      this.pixelBuf[i * 4 + 2] = this.waveform[i];
      this.pixelBuf[i * 4 + 3] = 255;

      // Row 1: frequency (FFT), grayscale
      this.pixelBuf[512 * 4 + i * 4]     = this.frequency[i];
      this.pixelBuf[512 * 4 + i * 4 + 1] = this.frequency[i];
      this.pixelBuf[512 * 4 + i * 4 + 2] = this.frequency[i];
      this.pixelBuf[512 * 4 + i * 4 + 3] = 255;
    }

    // Create or reuse texture
    if (!this.tex) {
      this.tex = gl.createTexture();
      if (!this.tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
    }

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      512, 2, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      this.pixelBuf
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    return {
      tex: this.tex,
      time: this.currentTime,
      resolution: [512, 2],
    };
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach(t => t.stop());
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.tex = null;
  }
}

// ─── Output engine (mainSound) ────────────────────────────────────────

const SOUND_CHUNK_SAMPLES = 4096;
const SOUND_SAMPLE_RATE   = 44100;

export class AudioOutputEngine {
  private audioCtx: AudioContext | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private tex: WebGLTexture | null = null;
  private isPlaying = false;
  private nextStartTime = 0;
  private currentSample = 0;

  get active(): boolean { return this.isPlaying; }

  /** Prepare the output engine with the compiled sound program */
  init(
    gl: WebGL2RenderingContext,
    soundProgram: WebGLProgram
  ): void {
    this.gl = gl;
    this.program = soundProgram;

    // Create FLOAT texture: width = chunk samples, height = 2 (L+R)
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, (gl as WebGL2RenderingContext).RGBA32F ?? gl.RGBA,
      SOUND_CHUNK_SAMPLES, 2, 0,
      gl.RGBA, gl.FLOAT, null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  start(): void {
    if (this.isPlaying || !this.gl || !this.program) return;
    this.audioCtx = new AudioContext({ sampleRate: SOUND_SAMPLE_RATE });
    this.isPlaying = true;
    this.nextStartTime = this.audioCtx.currentTime + 0.05;
    this.currentSample = 0;
    this.scheduleChunks();
  }

  private scheduleChunks(): void {
    if (!this.isPlaying || !this.audioCtx) return;

    // Schedule 3 chunks ahead
    while (this.nextStartTime < this.audioCtx.currentTime + 0.3) {
      this.renderAndScheduleChunk();
    }

    setTimeout(() => this.scheduleChunks(), 100);
  }

  private renderAndScheduleChunk(): void {
    const gl = this.gl!;
    const ctx = this.audioCtx!;

    // Render this chunk to FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, SOUND_CHUNK_SAMPLES, 2);
    gl.useProgram(this.program);

    const startTime = this.currentSample / SOUND_SAMPLE_RATE;

    // Bind uniforms needed by mainSound
    const setF = (name: string, v: number) => {
      const loc = gl.getUniformLocation(this.program!, name);
      if (loc) gl.uniform1f(loc, v);
    };
    setF('iSampleRate', SOUND_SAMPLE_RATE);
    setF('iTime', startTime);

    // iBlockOffset: the sample offset for this chunk
    const blockOffsetLoc = gl.getUniformLocation(this.program!, 'iBlockOffset');
    if (blockOffsetLoc) gl.uniform1f(blockOffsetLoc, startTime);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read pixels (RGBA float)
    const pixels = new Float32Array(SOUND_CHUNK_SAMPLES * 2 * 4);
    gl.readPixels(0, 0, SOUND_CHUNK_SAMPLES, 2, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Build AudioBuffer from R channel (row 0 = L, row 1 = R)
    const audioBuf = ctx.createBuffer(2, SOUND_CHUNK_SAMPLES, SOUND_SAMPLE_RATE);
    const left  = audioBuf.getChannelData(0);
    const right = audioBuf.getChannelData(1);

    for (let i = 0; i < SOUND_CHUNK_SAMPLES; i++) {
      // Row 0: sample i → pixel[i * 4] = R component = left
      left[i]  = pixels[i * 4];
      // Row 1: pixel[(CHUNK + i) * 4] = R component = right
      right[i] = pixels[(SOUND_CHUNK_SAMPLES + i) * 4];
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(ctx.destination);
    source.start(this.nextStartTime);

    this.nextStartTime += SOUND_CHUNK_SAMPLES / SOUND_SAMPLE_RATE;
    this.currentSample += SOUND_CHUNK_SAMPLES;
  }

  stop(): void {
    this.isPlaying = false;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }

  destroy(): void {
    this.stop();
    if (this.gl) {
      if (this.fbo) this.gl.deleteFramebuffer(this.fbo);
      if (this.tex) this.gl.deleteTexture(this.tex);
    }
    this.gl = null;
    this.program = null;
    this.fbo = null;
    this.tex = null;
  }
}
