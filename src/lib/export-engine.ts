/**
 * Export engine — handles PNG snapshot, WebM/MP4 video recording, and GIF export.
 */

import type { ExportConfig } from '@/types';

export async function exportPNG(canvas: HTMLCanvasElement, filename?: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { console.error('toBlob failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? `glslforge_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export class VideoRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private canvas: HTMLCanvasElement;
  private onStop: (blob: Blob) => void;

  constructor(canvas: HTMLCanvasElement, onStop: (blob: Blob) => void) {
    this.canvas = canvas;
    this.onStop = onStop;
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  start(fps = 30): boolean {
    const stream = this.canvas.captureStream(fps);
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    let mimeType = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
    }

    try {
      this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];

      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType || 'video/webm' });
        this.onStop(blob);
      };

      this.recorder.start(100); // collect data every 100ms
      return true;
    } catch (e) {
      console.error('MediaRecorder error:', e);
      return false;
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getExportDimensions(config: ExportConfig): { width: number; height: number } {
  const presets: Record<string, [number, number]> = {
    '1:1':   [1080, 1080],
    '9:16':  [1080, 1920],
    '16:9':  [1920, 1080],
    '4:5':   [1080, 1350],
    'custom': [config.width, config.height],
  };
  const [w, h] = presets[config.preset] ?? [config.width, config.height];
  return { width: w, height: h };
}

/**
 * GIF export using frame capture + gif.js
 * Requires gif.js to be loaded (CDN or local).
 */
export async function exportGIF(
  canvas: HTMLCanvasElement,
  duration: number,
  fps: number,
  onProgress?: (p: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Dynamically load gif.js
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
    script.onload = () => {
      // @ts-ignore – gif.js global
      const gif = new (window as any).GIF({
        workers: 2,
        quality: 10,
        width: canvas.width,
        height: canvas.height,
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
      });

      const totalFrames = Math.floor(duration * fps);
      const delay = Math.floor(1000 / fps);

      // We can't advance time in the renderer here — capture current frames as a snapshot loop
      for (let i = 0; i < totalFrames; i++) {
        gif.addFrame(canvas, { delay, copy: true });
      }

      gif.on('progress', (p: number) => onProgress?.(p));
      gif.on('finished', (blob: Blob) => {
        downloadBlob(blob, `glslforge_${Date.now()}.gif`);
        resolve();
      });
      gif.on('error', reject);
      gif.render();
    };
    script.onerror = () => reject(new Error('Failed to load gif.js'));
    document.head.appendChild(script);
  });
}
