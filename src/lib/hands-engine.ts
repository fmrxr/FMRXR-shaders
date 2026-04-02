/**
 * HandsEngine — MediaPipe Hands wrapper.
 *
 * Loads MediaPipe Hands from CDN (avoids SSR/bundle issues),
 * processes webcam frames at ~30fps, and emits normalized hand data.
 *
 * Phase 3: drives iMouse and custom uniforms (uHandPos, uPinchStrength, etc.)
 */

export interface HandData {
  /** Index fingertip position, normalized 0–1 (Y flipped for canvas coords) */
  pos: [number, number];
  /** 0 (open) → 1 (pinching) */
  pinchStrength: number;
  /** 0 (fist) → 1 (fully open) */
  handOpen: number;
  /** Wrist xyz, normalized 0–1 */
  wrist: [number, number, number];
}

// MediaPipe types (minimal, avoids requiring the npm package)
interface Landmark { x: number; y: number; z: number; }
interface HandsResults {
  multiHandLandmarks?: Landmark[][];
  multiHandedness?: Array<{ label: string; score: number }>;
}

declare class MPHands {
  constructor(config: { locateFile: (f: string) => string });
  setOptions(opts: object): void;
  onResults(cb: (r: HandsResults) => void): void;
  send(inputs: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

export class HandsEngine {
  private hands: MPHands | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private data: HandData | null = null;
  private onUpdate: (data: HandData | null) => void;

  constructor(onUpdate: (data: HandData | null) => void) {
    this.onUpdate = onUpdate;
  }

  get isRunning(): boolean { return this.running; }
  get currentData(): HandData | null { return this.data; }

  async start(): Promise<void> {
    if (this.running) return;

    // Dynamic CDN load — avoids bundling MediaPipe (large, SSR-incompatible)
    await new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[data-mediapipe-hands]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      s.setAttribute('data-mediapipe-hands', '1');
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load MediaPipe Hands'));
      document.head.appendChild(s);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Hands } = (window as any) as { Hands: typeof MPHands };

    this.hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults((results: HandsResults) => {
      if (results.multiHandLandmarks?.length) {
        this.data = this.computeHandData(results.multiHandLandmarks[0]);
      } else {
        this.data = null;
      }
      this.onUpdate(this.data);
    });

    // Hidden video element for camera feed
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;';
    document.body.appendChild(this.video);

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.running = true;
    this.processLoop();
  }

  private processLoop = async (): Promise<void> => {
    if (!this.running || !this.hands || !this.video) return;
    try {
      await this.hands.send({ image: this.video });
    } catch {
      // ignore frame errors
    }
    requestAnimationFrame(this.processLoop);
  };

  private computeHandData(landmarks: Landmark[]): HandData {
    const wrist    = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Pinch: normalized distance between index tip and thumb tip
    const pinchDist = Math.hypot(
      indexTip.x - thumbTip.x,
      indexTip.y - thumbTip.y
    );
    const pinchStrength = Math.max(0, Math.min(1, 1 - pinchDist / 0.15));

    // Hand openness: average distance of finger tips from wrist
    const tipIndices = [4, 8, 12, 16, 20];
    const avgDist = tipIndices.reduce((sum, idx) => {
      return sum + Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y);
    }, 0) / tipIndices.length;
    const handOpen = Math.max(0, Math.min(1, avgDist / 0.3));

    return {
      pos: [indexTip.x, 1 - indexTip.y], // flip Y for canvas coords
      pinchStrength,
      handOpen,
      wrist: [wrist.x, 1 - wrist.y, wrist.z],
    };
  }

  stop(): void {
    this.running = false;
    this.data = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.video?.remove();
    this.hands?.close();
    this.hands = null;
    this.video = null;
    this.stream = null;
    this.onUpdate(null);
  }
}
