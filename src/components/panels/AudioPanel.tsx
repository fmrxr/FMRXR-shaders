'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { AudioInputEngine } from '@/lib/audio-engine';
import type { ShaderEngine } from '@/lib/shader-engine';
import { clsx } from 'clsx';

interface Props {
  engineRef: React.RefObject<ShaderEngine | null>;
}

type InputSource = 'none' | 'mic' | 'file';

export function AudioPanel({ engineRef }: Props) {
  const { ui, setAudioEnabled } = useShaderStore();
  const audioEngineRef = useRef<AudioInputEngine | null>(null);
  const [source, setSource] = useState<InputSource>('none');
  const [error, setError] = useState<string | null>(null);
  const [channelIndex, setChannelIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animRef = useRef<number>(0);

  // Push audio texture to engine every frame
  const tick = useCallback(() => {
    const engine = engineRef.current;
    const audioEng = audioEngineRef.current;
    if (!engine || !audioEng || !ui.audioEnabled) return;

    const gl = engine.context as WebGL2RenderingContext;
    const data = audioEng.updateTexture(gl);
    if (data) {
      engine.setAudioChannel(channelIndex, data);
    }
    animRef.current = requestAnimationFrame(tick);
  }, [engineRef, channelIndex, ui.audioEnabled]);

  useEffect(() => {
    if (ui.audioEnabled && source !== 'none') {
      animRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [ui.audioEnabled, source, tick]);

  const startMic = async () => {
    setError(null);
    try {
      if (!audioEngineRef.current) audioEngineRef.current = new AudioInputEngine();
      await audioEngineRef.current.startMic();
      setSource('mic');
      setAudioEnabled(true);
    } catch {
      setError('Microphone access denied');
    }
  };

  const startFile = async (file: File) => {
    setError(null);
    try {
      if (!audioEngineRef.current) audioEngineRef.current = new AudioInputEngine();
      await audioEngineRef.current.startFile(file);
      setSource('file');
      setAudioEnabled(true);
    } catch {
      setError('Could not decode audio file');
    }
  };

  const stop = async () => {
    cancelAnimationFrame(animRef.current);
    engineRef.current?.setAudioChannel(channelIndex, null);
    await audioEngineRef.current?.stop();
    setSource('none');
    setAudioEnabled(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('audio/')) startFile(file);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-forge-text2">Audio Input</span>
        {source !== 'none' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-forge-green animate-pulse" />
            <span className="text-forge-green text-xs font-mono">
              {source === 'mic' ? 'Mic' : 'File'}
            </span>
          </div>
        )}
      </div>

      {/* Channel selector */}
      <div>
        <label className="text-xs font-mono text-forge-text2 mb-1.5 block">Bind to channel</label>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map(i => (
            <button
              key={i}
              onClick={() => setChannelIndex(i)}
              className={clsx(
                'flex-1 py-1 text-xs font-mono rounded transition-colors',
                channelIndex === i
                  ? 'bg-forge-accent text-white'
                  : 'bg-forge-bg4 text-forge-text2 hover:text-forge-text'
              )}
            >
              iCh{i}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      {source === 'none' ? (
        <div className="space-y-2">
          <button
            onClick={startMic}
            className="w-full btn-secondary text-xs flex items-center justify-center gap-2"
          >
            <span>🎤</span> Use Microphone
          </button>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'w-full border-2 border-dashed rounded-lg py-4 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-forge-accent bg-forge-accent/10 text-forge-accent'
                : 'border-forge-border2 text-forge-text2 hover:border-forge-accent/50'
            )}
          >
            <p className="text-xs font-mono">Drop audio file or click</p>
            <p className="text-forge-text2/50 text-xs font-mono mt-1">mp3, wav, ogg, flac</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) startFile(f); }}
          />
        </div>
      ) : (
        <button onClick={stop} className="w-full btn-secondary text-xs">
          Stop Audio
        </button>
      )}

      {error && (
        <p className="text-forge-red text-xs font-mono">{error}</p>
      )}

      <div className="border-t border-forge-border pt-3">
        <p className="text-forge-text2/60 text-xs font-mono leading-relaxed">
          Audio data is available as <span className="text-forge-accent3">iChannel{channelIndex}</span> in your shader.
          Row 0 = waveform, Row 1 = FFT.
        </p>
      </div>
    </div>
  );
}
