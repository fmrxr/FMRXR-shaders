'use client';

import { parseGLSLErrors } from '@/lib/uniform-parser';

interface ErrorBarProps {
  error: string;
}

export function ErrorBar({ error }: ErrorBarProps) {
  const errors = parseGLSLErrors(error);

  return (
    <div className="bg-forge-red/10 border-t border-forge-red/30 px-4 py-2 flex-shrink-0 max-h-24 overflow-y-auto">
      {errors.length > 0 ? (
        errors.map((e, i) => (
          <div key={i} className="flex items-start gap-3 text-xs font-mono py-0.5">
            <span className="text-forge-red/60 flex-shrink-0">Line {e.line}</span>
            <span className="text-forge-red">{e.message}</span>
          </div>
        ))
      ) : (
        <p className="text-forge-red text-xs font-mono line-clamp-2">{error}</p>
      )}
    </div>
  );
}
