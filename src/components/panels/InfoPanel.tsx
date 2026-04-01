'use client';

import { useShaderStore } from '@/store/shader-store';

export function InfoPanel() {
  const { project, stats } = useShaderStore();

  const statCells = [
    { label: 'Time',    value: stats.time.toFixed(2) + 's' },
    { label: 'Frame',   value: stats.frame.toLocaleString() },
    { label: 'FPS',     value: String(stats.fps) },
    { label: 'Width',   value: String(stats.resolution[0]) },
    { label: 'Height',  value: String(stats.resolution[1]) },
    { label: 'Buffers', value: String(project.buffers.length) },
    { label: 'Uniforms', value: String(project.uniforms.length) },
    { label: 'Passes',  value: String(project.buffers.length) },
  ];

  return (
    <div className="px-4 py-3 space-y-5">
      {/* Live stats grid */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-2">Live Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {statCells.map((s) => (
            <div key={s.label} className="bg-forge-bg3 rounded-md px-3 py-2">
              <div className="text-forge-text2/60 text-xs font-mono">{s.label}</div>
              <div className="text-forge-text text-sm font-mono font-semibold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Built-in uniforms reference */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-2">Built-in Uniforms</p>
        <div className="space-y-1.5">
          {[
            { name: 'iTime',        type: 'float', desc: 'Elapsed seconds' },
            { name: 'iResolution',  type: 'vec2',  desc: 'Canvas size in px' },
            { name: 'iMouse',       type: 'vec4',  desc: 'xy=pos, zw=click' },
            { name: 'iFrame',       type: 'int',   desc: 'Frame counter' },
            { name: 'iTimeDelta',   type: 'float', desc: 'Time since last frame' },
            { name: 'iChannel0–3',  type: 'sampler2D', desc: 'Buffer textures' },
          ].map((u) => (
            <div key={u.name} className="flex items-start gap-2 text-xs font-mono py-0.5">
              <span className="text-forge-accent2 w-24 flex-shrink-0">{u.name}</span>
              <span className="text-forge-accent3/70 w-16 flex-shrink-0">{u.type}</span>
              <span className="text-forge-text2/50">{u.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Uniform annotation syntax */}
      <div>
        <p className="text-forge-text2/60 text-xs font-mono uppercase tracking-wider mb-2">Annotations</p>
        <pre className="text-xs font-mono text-forge-text2 bg-forge-bg3 rounded p-3 leading-relaxed overflow-x-auto">{`// @label My Param
// @min 0.0 @max 10.0
// @step 0.01
uniform float u_name;`}</pre>
      </div>
    </div>
  );
}
