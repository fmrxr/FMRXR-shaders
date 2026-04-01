# GLSL Forge

A professional, Shadertoy-inspired shader creation platform built with Next.js 14, WebGL2, and Supabase. Create, edit, and export real-time GLSL shaders with a designer-grade UI.

---

## Features

- **WebGL2 multi-pass rendering** — Image + Buffer A/B/C/D pipeline with ping-pong framebuffers
- **Monaco Editor** — GLSL syntax highlighting, autocompletion, inline error display
- **Auto-generated uniform controls** — parse `@min/@max/@label` annotations → sliders, toggles, color pickers
- **Shadertoy-compatible built-ins** — `iTime`, `iResolution`, `iMouse`, `iFrame`, `iChannel0–3`
- **Export system** — PNG snapshot, WebM/MP4 recording (MediaRecorder), GIF export (gif.js)
- **Social presets** — 1:1, 9:16, 16:9, 4:5 aspect ratios
- **Shader library** — 6 built-in examples: Plasma, Mandelbrot, Raymarcher, FBM Noise, Reaction-Diffusion
- **Save & share** — Supabase persistence, public/private toggle, shareable `/shader/[id]` URLs
- **Public gallery** — `/explore` page with thumbnail previews
- **Keyboard shortcuts** — Space, Ctrl+S, Ctrl+Enter, Ctrl+R, Ctrl+P, Ctrl+B
- **Resizable panels** — drag the editor handle to resize
- **Quality scaling** — 0.25×, 0.5×, 0.75×, 1× for performance tuning

---

## Tech Stack

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Framework   | Next.js 14 (App Router)                      |
| Language    | TypeScript (strict)                          |
| Rendering   | WebGL2 (raw, no abstraction library)         |
| Editor      | Monaco Editor with custom GLSL tokenizer     |
| State       | Zustand + immer                              |
| Styling     | Tailwind CSS + custom forge design tokens    |
| Database    | Supabase (PostgreSQL + RLS)                  |
| Storage     | Supabase Storage (thumbnails, exports)       |
| Deployment  | Vercel                                       |

---

## Project Structure

```
glslforge/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main editor page
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── not-found.tsx
│   │   ├── explore/
│   │   │   ├── page.tsx               # Public gallery
│   │   │   └── GalleryGrid.tsx
│   │   ├── shader/[id]/
│   │   │   ├── page.tsx               # Public viewer
│   │   │   └── ShaderViewer.tsx
│   │   └── api/
│   │       ├── shaders/route.ts       # GET list / POST create
│   │       ├── shaders/[id]/route.ts  # GET / PUT / DELETE
│   │       └── export/route.ts
│   ├── components/
│   │   ├── renderer/
│   │   │   └── ShaderCanvas.tsx       # WebGL canvas + overlay
│   │   ├── editor/
│   │   │   ├── ShaderEditor.tsx       # Monaco + GLSL theme
│   │   │   ├── EditorTabs.tsx         # Buffer tab bar
│   │   │   └── ErrorBar.tsx
│   │   ├── panels/
│   │   │   ├── RightPanel.tsx         # Tabbed right panel
│   │   │   ├── UniformsPanel.tsx      # Auto-generated controls
│   │   │   ├── BuffersPanel.tsx       # Buffer routing view
│   │   │   ├── ExportPanel.tsx        # Export controls
│   │   │   └── InfoPanel.tsx          # Stats + reference
│   │   └── ui/
│   │       ├── TopBar.tsx
│   │       ├── Sidebar.tsx            # Shader library
│   │       ├── StatusBar.tsx
│   │       ├── SaveModal.tsx
│   │       ├── ResizablePanel.tsx
│   │       ├── Toast.tsx
│   │       └── KeyboardShortcutsHelp.tsx
│   ├── hooks/
│   │   ├── useShaderEngine.ts         # RAF loop + WebGL lifecycle
│   │   ├── useExport.ts               # PNG / WebM export
│   │   ├── useAutoCompile.ts          # Debounced compile
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/
│   │   ├── shader-engine.ts           # Core WebGL2 engine
│   │   ├── webgl-utils.ts             # Low-level GL helpers
│   │   ├── uniform-parser.ts          # GLSL → UniformDef[]
│   │   ├── export-engine.ts           # PNG/WebM/GIF export
│   │   ├── glsl-templates.ts          # Built-in shader code
│   │   ├── keyboard-shortcuts.ts
│   │   └── utils.ts
│   ├── services/
│   │   └── supabase.ts                # Typed DB queries
│   ├── store/
│   │   └── shader-store.ts            # Zustand global state
│   └── types/
│       └── index.ts                   # All TypeScript types
├── supabase/
│   └── schema.sql                     # Full DB schema + RLS
├── .env.example
├── vercel.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/yourname/glslforge.git
cd glslforge
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Settings → API** and copy your `Project URL` and `anon key`

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual deploy

```bash
npm i -g vercel
vercel login
vercel
```

Set the following environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |

---

## Writing Shaders

### Built-in uniforms

```glsl
uniform float iTime;        // Elapsed time in seconds
uniform vec2  iResolution;  // Canvas size in pixels (width, height)
uniform vec4  iMouse;       // Mouse: xy = position, zw = click position
uniform int   iFrame;       // Frame counter
uniform float iTimeDelta;   // Time since last frame
uniform sampler2D iChannel0; // Buffer A texture
uniform sampler2D iChannel1; // Buffer B texture
uniform sampler2D iChannel2; // Buffer C texture
uniform sampler2D iChannel3; // Buffer D texture
```

### Custom uniforms with annotations

Annotate uniforms with comment directives to auto-generate UI controls:

```glsl
// @label Speed   @min 0.1  @max 5.0  @step 0.01
uniform float u_speed;

// @label Scale   @min 0.5  @max 8.0
uniform float u_scale;

// @label Color
uniform vec3 u_color;   // detected as color picker from name

// @label Octaves @min 1.0 @max 8.0
uniform float u_octaves;
```

Supported types and their generated controls:

| GLSL Type | Control |
|---|---|
| `float` | Slider |
| `int` | Integer slider |
| `vec2` | Two sliders (X, Y) |
| `vec3` (named `*color*` or `*col*`) | Color picker |
| `bool` | Toggle |

### Multi-pass example

**Buffer A** — simulation step:
```glsl
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D iChannel0; // reads previous Buffer A frame

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec4 prev = texture2D(iChannel0, uv);
  // ... simulation logic ...
  gl_FragColor = prev;
}
```

**Image** — render Buffer A output:
```glsl
precision highp float;
uniform vec2 iResolution;
uniform sampler2D iChannel0; // Buffer A result

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec4 sim = texture2D(iChannel0, uv);
  gl_FragColor = vec4(sim.rg, 0.0, 1.0);
}
```

---

## Export

| Format | Method | Notes |
|---|---|---|
| PNG | `canvas.toBlob()` | Current frame, full resolution |
| WebM | `MediaRecorder API` | Real-time capture, configurable duration + FPS |
| GIF | `gif.js` | Frame capture, loaded from CDN |

Export is entirely client-side — no server rendering required.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Toggle play / pause |
| `Ctrl+Enter` | Compile shader |
| `Ctrl+S` | Save shader |
| `Ctrl+P` | PNG snapshot |
| `Ctrl+R` | Reset time |
| `Ctrl+B` | Toggle sidebar |

---

## License

MIT — free to use, modify, and deploy commercially.
