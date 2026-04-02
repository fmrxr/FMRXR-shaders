# GLSLForge — Shadertoy Import, Audio & MediaPipe Hands Design

**Date:** 2026-04-02  
**Status:** Approved

---

## Overview

Three phases that together make GLSLForge a full Shadertoy-compatible environment with audio reactivity and hand-tracking control.

- **Phase 1** — Import any Shadertoy shader by URL (no API key required)
- **Phase 2** — Audio input (mic/file → iChannel FFT texture) + audio output (mainSound playback)
- **Phase 3** — MediaPipe hand tracking → iMouse + custom hand uniforms

Phases are independent and shippable in order. Phase 1 is the foundation.

---

## Phase 1 — Shadertoy Import

### Approach

Server-side page scraping via a Next.js API route. No Shadertoy API key required. Shadertoy embeds the full shader JSON (renderpass array) in every public shader page inside a `<script>` tag. The server fetches the page with browser-like headers, extracts the JSON, adapts it to GLSLForge's `ShaderProject` format, and returns it to the client.

### New Files

#### `src/app/api/import-shadertoy/route.ts`
- Accepts `GET ?url=https://www.shadertoy.com/view/{id}`
- Extracts shader ID from URL
- Fetches `https://www.shadertoy.com/view/{id}` server-side with spoofed User-Agent
- Calls `parsePage(html)` → `adaptToProject(data)`
- Returns `ShaderProject`-shaped JSON
- Error cases: invalid URL, fetch failure, private shader (no renderpass in HTML), parse failure

#### `src/app/api/proxy-media/route.ts`
- Accepts `GET ?src=/media/a/hash.ext`
- Fetches `https://www.shadertoy.com{src}` server-side
- Streams binary response back with correct `Content-Type`
- Used by texture loader to avoid CORS on Shadertoy CDN assets

#### `src/lib/shadertoy-importer.ts`
Pure functions, no side effects:

```ts
extractId(url: string): string
// Extracts shader ID from shadertoy.com/view/{id} or bare ID string

parsePage(html: string): ShadertoyRenderpass[]
// Finds JSON embedded in <script> tag, returns renderpass array

adaptToProject(passes: ShadertoyRenderpass[], title: string): ShaderProject
// Maps passes → ShaderBuffer[], resolves channel inputs

wrapCode(code: string, commonCode?: string): string
// Prepends common pass code
// Appends: void main(){ mainImage(fragColor, gl_FragCoord.xy); }

buildChannels(inputs: ShadertoyInput[]): (string | null)[]
// Maps iChannel0–3: buffer ref → buffer id, texture → proxy URL, unsupported → null
```

**Buffer mapping:**
| Shadertoy pass type | GLSLForge buffer id |
|---|---|
| `"image"` | `"image"` |
| `"buffer"` (1st) | `"bufA"` |
| `"buffer"` (2nd) | `"bufB"` |
| `"buffer"` (3rd) | `"bufC"` |
| `"buffer"` (4th) | `"bufD"` |
| `"common"` | prepended to all buffer code |

**Channel type handling:**
| `ctype` | Action |
|---|---|
| `"texture"` | Proxy URL → loaded as WebGL 2D texture |
| `"cubemap"` | Proxy URL → loaded as 2D texture (face 0, best-effort) |
| `"buffer"` | Mapped to buffer id string |
| `"video"`, `"music"`, `"musicstream"`, `"webcam"`, `"keyboard"` | `null` + warning collected |

#### `src/components/ui/ImportModal.tsx`
- Text input for Shadertoy URL
- Validate: must match `shadertoy.com/view/` pattern
- Loading spinner during fetch
- Error display (private shader, network error, parse failure)
- On success: calls `store.setProject()`, closes modal
- Shows warnings for unsupported channels

### Modified Files

#### `src/components/ui/TopBar.tsx`
- Add "Import" button between Save and Share
- Opens `ImportModal`

#### `src/lib/uniform-parser.ts`
Add to `BUILTIN_UNIFORMS`:
```
iFrameRate, iDate, iSampleRate, iChannelTime, iChannelResolution
```

#### `src/lib/shader-engine.ts`
**Fix `iResolution`:** change from `vec2` to `vec3` — bind `[width, height, 1.0]`

**Add missing uniform bindings per frame:**
```
iFrameRate    → float  (1.0 / deltaTime, clamped 1–120)
iDate         → vec4   (year, month, day, seconds since midnight)
iSampleRate   → float  (44100.0 constant)
iChannelTime  → float[4] (zeroed until Phase 2)
iChannelResolution → vec3[4] (zeroed until Phase 2, filled when textures loaded)
```

**Texture cache:** `Map<string, WebGLTexture>` keyed by proxy URL.  
On `setProject()`: for each channel URL, kick off `loadTextureFromUrl()`.  
In `bindChannels()`: if channel value starts with `/api/proxy-media`, look up cache; otherwise treat as buffer id.

#### `src/lib/webgl-utils.ts`
Add `loadTextureFromUrl(gl, url): Promise<WebGLTexture>`:
- Fetches URL as blob
- Creates `ImageBitmap`
- Uploads to `WebGLTexture` with `CLAMP_TO_EDGE` wrap, `LINEAR` filter
- Returns texture

---

## Phase 2 — Audio

### Audio Input (mic/file → iChannel)

**`src/lib/audio-engine.ts`**  
Web Audio API wrapper:
- Sources: microphone (`getUserMedia`) or audio file (drag/drop or file picker)
- Pipeline: source → `AnalyserNode` (fftSize 1024) → two float arrays per frame:
  - Row 0: waveform (time domain), 512 floats normalized −1..1 → mapped 0..1
  - Row 1: FFT magnitude, 512 floats normalized 0..1
- Each frame: upload both rows to a `512×2` `WebGLTexture` (`LUMINANCE` or `R32F` format)
- Exposes: `getTexture()`, `getChannelTime()`, `start()`, `stop()`

When a buffer channel is assigned an audio source, `iChannelTime[i]` is set to the audio playback position each frame. `iChannelResolution[i]` is set to `[512, 2, 0]`.

**UI additions:**
- Audio section in `UniformsPanel` or new tab: mic toggle button + audio file drop zone
- Channel assignment: user can drag the audio source onto a channel slot in `BuffersPanel`

### Audio Output (mainSound)

**Detection:** `parsePage` / `adaptToProject` detects a pass with `type: "sound"`. Imported as a separate buffer but flagged as sound output.

**Rendering:**
- Render the sound shader offscreen to a `FLOAT` texture (width = sample count per chunk, height = 2 for stereo)
- Read pixels → `Float32Array` → fill `AudioBuffer` → queue via `AudioBufferSourceNode`
- `iSampleRate` bound to `44100.0`
- Chunked rendering: render N samples ahead, schedule playback, repeat

**UI:** waveform oscilloscope preview in `InfoPanel` when sound pass is active. Play/pause synced with main loop pause button.

---

## Phase 3 — MediaPipe Hands

### New Dependency

```
@mediapipe/hands
@mediapipe/camera_utils
```

### `src/lib/hands-engine.ts`

- Initializes `@mediapipe/hands` with `maxNumHands: 2`
- Attaches to a hidden `<video>` element fed by `getUserMedia({ video: true })`
- Emits landmark data at ~30fps via callback
- Exports per-frame:
  - `dominantHand`: 21 landmarks `{x, y, z}` normalized 0..1
  - `pinchStrength`: distance index tip → thumb tip, mapped 0..1 inverted
  - `handOpen`: average finger extension, 0..1
  - `wristPos`: landmark 0 xyz

### iMouse from hands

When hands mode is enabled, `ShaderEngine` receives hand data each frame:
- `iMouse.xy` ← index fingertip `(x * width, (1-y) * height)` (flipped Y to match canvas coords)
- `iMouse.zw` ← same values when pinch is active (pinchStrength > 0.7), else `(0, 0)`

Existing mouse event listeners remain active — hands override when enabled.

### Custom Hand Uniforms

When hands mode is enabled, these uniforms are available to all shaders. They are auto-injected as declarations at compile time if the shader references them:

```glsl
uniform vec2  uHandPos;        // index fingertip, normalized 0–1
uniform float uPinchStrength;  // 0.0 (open) – 1.0 (pinching)
uniform float uHandOpen;       // 0.0 (fist) – 1.0 (fully open)
uniform vec3  uWrist;          // wrist position xyz, normalized 0–1
```

These are bound by `ShaderEngine` alongside other custom uniforms each frame.

In `UniformsPanel`, hand uniforms appear as **live display widgets** (read-only animated bars), not sliders, clearly labeled "Hand Tracking".

### `src/components/ui/HandsPanel.tsx`

New tab or section in `RightPanel`:
- Enable/disable toggle (requests camera permission on first enable)
- Small webcam preview with skeleton overlay (canvas drawn over video)
- Hand landmark confidence indicator
- `iMouse override` toggle (separate from global enable)

---

## Shared Concerns

### Engine Initialization Order

`ShaderEngine` is the single source of truth for uniform binding. Audio and hands engines feed data into it each frame via setter methods (`setAudioTexture(channel, tex, time)`, `setHandData(data)`). No direct WebGL calls from audio/hands engines.

### Permissions

- Audio input: `navigator.mediaDevices.getUserMedia({ audio: true })`
- Video (hands): `navigator.mediaDevices.getUserMedia({ video: true })`
- Both requested lazily on first enable, with clear UI feedback on denial

### Error Boundaries

- Import: private/nonexistent shader shows inline error in modal
- Audio: graceful fallback if mic denied (channels stay null)
- Hands: graceful fallback if camera denied (hand uniforms stay at zero)

### Explicit Out of Scope

- Shadertoy API key integration
- VR shaders (`mainVR`) — imported as image shader, no stereo rendering
- Keyboard channel (`ctype: "keyboard"`) — null, no special handling
- Multi-hand uniforms for second hand (second hand data ignored in Phase 3 v1)

---

## Implementation Order

```
Phase 1a: Engine uniform fixes (iResolution vec3 + 5 missing uniforms)
Phase 1b: Proxy media route + webgl texture loader
Phase 1c: Shadertoy importer lib + import API route
Phase 1d: ImportModal + TopBar button
Phase 2a: AudioEngine (input) + UI
Phase 2b: mainSound output rendering
Phase 3a: HandsEngine + iMouse override
Phase 3b: Custom hand uniforms + HandsPanel UI
```
