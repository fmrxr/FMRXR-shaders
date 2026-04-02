'use client';

import { useEffect, useRef, useState } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { HandsEngine } from '@/lib/hands-engine';
import type { HandData } from '@/lib/hands-engine';
import type { ShaderEngine } from '@/lib/shader-engine';
import { clsx } from 'clsx';

interface Props {
  engineRef: React.RefObject<ShaderEngine | null>;
}

export function HandsPanel({ engineRef }: Props) {
  const { ui, setHandsEnabled } = useShaderStore();
  const handsEngRef = useRef<HandsEngine | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iMouseOverride, setIMouseOverride] = useState(true);

  // Sync hand data to engine on every update
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setHandsEnabled(ui.handsEnabled);
    engine.setHandData(handData);
  }, [handData, ui.handsEnabled, engineRef]);

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      handsEngRef.current = new HandsEngine((data) => {
        setHandData(data);
        engineRef.current?.setHandData(data);
      });
      await handsEngRef.current.start();
      setHandsEnabled(true);
      engineRef.current?.setHandsEnabled(true);
    } catch (e) {
      setError((e as Error).message.includes('Permission')
        ? 'Camera access denied'
        : 'Failed to start hand tracking'
      );
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    handsEngRef.current?.stop();
    handsEngRef.current = null;
    setHandData(null);
    setHandsEnabled(false);
    engineRef.current?.setHandsEnabled(false);
  };

  // Cleanup on unmount
  useEffect(() => () => { handsEngRef.current?.stop(); }, []);

  const fmt = (v: number) => v.toFixed(2);

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-forge-text2">Hand Tracking</span>
        {ui.handsEnabled && (
          <div className="flex items-center gap-1.5">
            <span className={clsx(
              'w-2 h-2 rounded-full',
              handData ? 'bg-forge-green animate-pulse' : 'bg-forge-amber'
            )} />
            <span className={clsx(
              'text-xs font-mono',
              handData ? 'text-forge-green' : 'text-forge-amber'
            )}>
              {handData ? 'Hand detected' : 'No hand'}
            </span>
          </div>
        )}
      </div>

      {/* Toggle */}
      {!ui.handsEnabled ? (
        <button
          onClick={start}
          disabled={loading}
          className="w-full btn-secondary text-xs flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-forge-text2/30 border-t-forge-text2 rounded-full animate-spin" />
              Loading model…
            </>
          ) : (
            <><span>✋</span> Enable Hand Tracking</>
          )}
        </button>
      ) : (
        <button onClick={stop} className="w-full btn-secondary text-xs">
          Disable Hand Tracking
        </button>
      )}

      {error && <p className="text-forge-red text-xs font-mono">{error}</p>}

      {/* iMouse override toggle */}
      {ui.handsEnabled && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-forge-text2">Override iMouse</span>
          <button
            onClick={() => {
              const next = !iMouseOverride;
              setIMouseOverride(next);
              // iMouse override is always on when handsEnabled in the engine;
              // this just controls the visual indicator
            }}
            className={clsx(
              'w-10 h-5 rounded-full transition-colors relative',
              iMouseOverride ? 'bg-forge-accent' : 'bg-forge-bg5'
            )}
          >
            <span className={clsx(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              iMouseOverride ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      )}

      {/* Live hand data display */}
      {ui.handsEnabled && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-forge-text2/60 uppercase tracking-wider">Live uniforms</p>

          <LiveBar label="uHandPos.x" value={handData?.pos[0] ?? 0} />
          <LiveBar label="uHandPos.y" value={handData?.pos[1] ?? 0} />
          <LiveBar label="uPinchStrength" value={handData?.pinchStrength ?? 0} color="amber" />
          <LiveBar label="uHandOpen" value={handData?.handOpen ?? 0} color="green" />

          {handData && (
            <div className="bg-forge-bg3 rounded-lg px-3 py-2 font-mono text-xs text-forge-text2 space-y-0.5">
              <div>uWrist: ({fmt(handData.wrist[0])}, {fmt(handData.wrist[1])}, {fmt(handData.wrist[2])})</div>
            </div>
          )}
        </div>
      )}

      {!ui.handsEnabled && (
        <div className="border-t border-forge-border pt-3">
          <p className="text-forge-text2/60 text-xs font-mono leading-relaxed">
            Uses your webcam. Hand position drives{' '}
            <span className="text-forge-accent3">iMouse</span> and custom uniforms{' '}
            <span className="text-forge-accent3">uHandPos</span>,{' '}
            <span className="text-forge-accent3">uPinchStrength</span>,{' '}
            <span className="text-forge-accent3">uHandOpen</span>.
          </p>
        </div>
      )}
    </div>
  );
}

function LiveBar({
  label,
  value,
  color = 'accent',
}: {
  label: string;
  value: number;
  color?: 'accent' | 'amber' | 'green';
}) {
  const colors = {
    accent: 'bg-forge-accent',
    amber:  'bg-forge-amber',
    green:  'bg-forge-green',
  };
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-xs font-mono text-forge-accent3">{label}</span>
        <span className="text-xs font-mono text-forge-text2">{value.toFixed(3)}</span>
      </div>
      <div className="h-1 bg-forge-bg4 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-75', colors[color])}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
}
