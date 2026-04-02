'use client';

import { useRef } from 'react';
import { TopBar }          from '@/components/ui/TopBar';
import { Sidebar }         from '@/components/ui/Sidebar';
import { ShaderCanvas }    from '@/components/renderer/ShaderCanvas';
import { ShaderEditor }    from '@/components/editor/ShaderEditor';
import { RightPanel }      from '@/components/panels/RightPanel';
import { ResizablePanel }  from '@/components/ui/ResizablePanel';
import { StatusBar }       from '@/components/ui/StatusBar';
import { ToastContainer }  from '@/components/ui/Toast';
import type { ShaderEngine } from '@/lib/shader-engine';

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ShaderEngine | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar />

        {/* Center: canvas + editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ShaderCanvas engineRef={engineRef} />

          <ResizablePanel defaultHeight={280} minHeight={100} maxHeight={600}>
            <ShaderEditor />
          </ResizablePanel>
        </div>

        <RightPanel canvasRef={canvasRef} engineRef={engineRef} />
      </div>

      <StatusBar />
      <ToastContainer />
    </div>
  );
}
