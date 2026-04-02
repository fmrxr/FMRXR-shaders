'use client';

import { useState } from 'react';
import { useShaderStore } from '@/store/shader-store';
import type { UniformDef } from '@/types';
import { clsx } from 'clsx';

export function UniformsPanel() {
  const { project, updateUniform } = useShaderStore();
  const uniforms = project.uniforms;

  if (uniforms.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-forge-text2 text-xs font-mono leading-relaxed">
          No custom uniforms detected.
        </p>
        <p className="text-forge-text2/50 text-xs font-mono mt-2 leading-relaxed">
          Add to your shader:
        </p>
        <pre className="text-forge-accent3 text-xs font-mono mt-2 text-left bg-forge-bg3 rounded p-3 leading-relaxed">
{`// @min 0.0 @max 5.0
uniform float u_speed;`}
        </pre>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {uniforms.map((u) => (
        <UniformControl key={u.name} def={u} onChange={(v) => updateUniform(u.name, v)} />
      ))}
    </div>
  );
}

interface UniformControlProps {
  def: UniformDef;
  onChange: (value: UniformDef['value']) => void;
}

function UniformControl({ def, onChange }: UniformControlProps) {
  const { name, type, value, min = 0, max = 1, step, label } = def;
  // Allow toggling vec3/vec4 between color picker and sliders
  const [forceColor, setForceColor] = useState(type === 'color');

  const isColorType = type === 'color' || ((type === 'vec3' || type === 'vec4') && forceColor);
  const canToggleColor = type === 'vec3' || type === 'vec4' || type === 'color';

  // ── Color picker ────────────────────────────────────────────────────
  if (isColorType) {
    const rgb = Array.isArray(value) ? value as number[] : [0.5, 0.5, 0.5];
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono text-forge-accent3">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-forge-text2 opacity-60">{name}</span>
            {canToggleColor && type !== 'color' && (
              <button
                onClick={() => setForceColor(false)}
                className="text-forge-text2/40 hover:text-forge-text2 text-xs font-mono transition-colors"
                title="Switch to sliders"
              >⇄</button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              const [r, g, b] = hexToRgb(e.target.value);
              const next = type === 'vec4' && Array.isArray(value) && value.length === 4
                ? [r, g, b, (value as number[])[3]]
                : [r, g, b];
              onChange(next as UniformDef['value']);
            }}
            className="w-8 h-8 rounded cursor-pointer border border-forge-border2 bg-transparent p-0.5"
          />
          <div className="flex-1 h-8 rounded" style={{ background: `linear-gradient(135deg, ${hex}, #000)` }} />
          <span className="text-xs font-mono text-forge-text2">{hex.toUpperCase()}</span>
        </div>
        {/* Alpha slider for vec4 */}
        {(type === 'vec4' || type === 'color') && Array.isArray(value) && value.length === 4 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-forge-text2 text-xs font-mono w-3">A</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={(value as number[])[3]}
              onChange={(e) => {
                const next = [...(value as number[])] as [number, number, number, number];
                next[3] = parseFloat(e.target.value);
                onChange(next);
              }}
              className="flex-1 accent-forge-accent"
            />
            <span className="text-forge-text2 text-xs font-mono w-10 text-right">
              {((value as number[])[3]).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Bool toggle ─────────────────────────────────────────────────────
  if (type === 'bool') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-forge-accent3">{label}</span>
        <button
          onClick={() => onChange(!value)}
          className={clsx(
            'w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
            value ? 'bg-forge-accent' : 'bg-forge-bg5'
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              value ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    );
  }

  // ── Vec2 sliders ────────────────────────────────────────────────────
  if (type === 'vec2') {
    const v = Array.isArray(value) ? value as [number, number] : [0, 0];
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-forge-accent3">{label}</span>
        </div>
        <div className="space-y-2">
          {['X', 'Y'].map((axis, i) => (
            <div key={axis} className="flex items-center gap-2">
              <span className="text-forge-text2 text-xs font-mono w-3">{axis}</span>
              <input
                type="range"
                min={min} max={max} step={step ?? (max - min) / 200}
                value={v[i]}
                onChange={(e) => {
                  const next = [...v] as [number, number];
                  next[i] = parseFloat(e.target.value);
                  onChange(next);
                }}
                className="flex-1 accent-forge-accent"
              />
              <span className="text-forge-text2 text-xs font-mono w-10 text-right">
                {v[i].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vec3 sliders (with color toggle) ────────────────────────────────
  if (type === 'vec3') {
    const v = Array.isArray(value) ? value as [number, number, number] : [0, 0, 0];
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-forge-accent3">{label}</span>
          <button
            onClick={() => setForceColor(true)}
            className="text-forge-text2/40 hover:text-forge-accent text-xs font-mono transition-colors"
            title="Switch to color picker"
          >
            🎨
          </button>
        </div>
        <div className="space-y-2">
          {(['X', 'Y', 'Z'] as const).map((axis, i) => (
            <div key={axis} className="flex items-center gap-2">
              <span className="text-forge-text2 text-xs font-mono w-3">{axis}</span>
              <input
                type="range"
                min={min} max={max} step={step ?? (max - min) / 200}
                value={v[i]}
                onChange={(e) => {
                  const next = [...v] as [number, number, number];
                  next[i] = parseFloat(e.target.value);
                  onChange(next);
                }}
                className="flex-1 accent-forge-accent"
              />
              <span className="text-forge-text2 text-xs font-mono w-10 text-right">
                {v[i].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vec4 sliders (with color toggle) ────────────────────────────────
  if (type === 'vec4') {
    const v = Array.isArray(value) ? value as [number, number, number, number] : [0, 0, 0, 1];
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-forge-accent3">{label}</span>
          <button
            onClick={() => setForceColor(true)}
            className="text-forge-text2/40 hover:text-forge-accent text-xs font-mono transition-colors"
            title="Switch to color picker"
          >
            🎨
          </button>
        </div>
        <div className="space-y-2">
          {(['X', 'Y', 'Z', 'W'] as const).map((axis, i) => (
            <div key={axis} className="flex items-center gap-2">
              <span className="text-forge-text2 text-xs font-mono w-3">{axis}</span>
              <input
                type="range"
                min={min} max={max} step={step ?? (max - min) / 200}
                value={v[i]}
                onChange={(e) => {
                  const next = [...v] as [number, number, number, number];
                  next[i] = parseFloat(e.target.value);
                  onChange(next);
                }}
                className="flex-1 accent-forge-accent"
              />
              <span className="text-forge-text2 text-xs font-mono w-10 text-right">
                {v[i].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Int slider ──────────────────────────────────────────────────────
  if (type === 'int') {
    const v = typeof value === 'number' ? value : 0;
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono text-forge-accent3">{label}</span>
          <span className="text-xs font-mono text-forge-amber">{Math.round(v)}</span>
        </div>
        <input
          type="range"
          min={min} max={max} step={1}
          value={v}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full accent-forge-accent"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-forge-text2/40 text-xs font-mono">{min}</span>
          <span className="text-forge-text2/40 text-xs font-mono">{max}</span>
        </div>
      </div>
    );
  }

  // ── Float slider (default) ──────────────────────────────────────────
  const v = typeof value === 'number' ? value : 0;
  const pct = ((v - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-forge-accent3">{label}</span>
        <span className="text-xs font-mono text-forge-amber">{v.toFixed(3)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min} max={max} step={step ?? (max - min) / 200}
          value={v}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-forge-accent h-1 bg-forge-bg5 rounded appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #6c63ff ${pct}%, #202030 ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-forge-text2/40 text-xs font-mono">{min}</span>
        <span className="text-forge-text2/40 text-xs font-mono">{max}</span>
      </div>
    </div>
  );
}

// ── Color utils ──────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}
