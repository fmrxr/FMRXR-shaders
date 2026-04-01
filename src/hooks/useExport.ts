'use client';

import { useRef, useCallback } from 'react';
import { useShaderStore } from '@/store/shader-store';
import { exportPNG, VideoRecorder, downloadBlob, getExportDimensions } from '@/lib/export-engine';

export function useExport(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const recorderRef = useRef<VideoRecorder | null>(null);
  const { ui, setRecording, setExporting } = useShaderStore();

  const snapshot = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await exportPNG(canvas, `glslforge_${Date.now()}.png`);
  }, [canvasRef]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const recorder = new VideoRecorder(canvas, (blob) => {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `glslforge_${Date.now()}.${ext}`);
      setRecording(false);
    });

    const ok = recorder.start(ui.exportConfig.fps);
    if (ok) {
      recorderRef.current = recorder;
      setRecording(true);

      // Auto-stop after duration
      const duration = ui.exportConfig.duration * 1000;
      setTimeout(() => stopRecording(), duration);
    }
    return ok;
  }, [canvasRef, ui.exportConfig, setRecording]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const toggleRecording = useCallback(() => {
    if (ui.isRecording) stopRecording();
    else startRecording();
  }, [ui.isRecording, startRecording, stopRecording]);

  return { snapshot, toggleRecording, startRecording, stopRecording };
}
