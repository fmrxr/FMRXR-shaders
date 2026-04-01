'use client';

import Link from 'next/link';
import type { ShaderProject } from '@/types';
import { clsx } from 'clsx';

interface GalleryGridProps {
  shaders: ShaderProject[];
}

export function GalleryGrid({ shaders }: GalleryGridProps) {
  if (shaders.length === 0) {
    return (
      <div className="text-center py-24 text-forge-text2">
        <p className="text-5xl mb-4 opacity-20">◈</p>
        <p className="font-mono">No public shaders yet.</p>
        <Link href="/" className="text-forge-accent text-sm mt-2 inline-block hover:underline">
          Create the first one →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {shaders.map((shader) => (
        <ShaderCard key={shader.id} shader={shader} />
      ))}
    </div>
  );
}

function ShaderCard({ shader }: { shader: ShaderProject }) {
  const timeAgo = formatTimeAgo(shader.updatedAt);

  return (
    <Link
      href={`/shader/${shader.id}`}
      className="group bg-forge-bg2 border border-forge-border rounded-xl overflow-hidden hover:border-forge-border2 transition-all hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-forge-bg3 relative overflow-hidden">
        {shader.thumbnail ? (
          <img
            src={shader.thumbnail}
            alt={shader.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl text-forge-text2/10 font-mono font-black">
              {shader.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-forge-accent/0 group-hover:bg-forge-accent/5 transition-colors" />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-forge-text font-medium text-sm truncate mb-1">
          {shader.title}
        </h3>
        {shader.description && (
          <p className="text-forge-text2 text-xs font-mono line-clamp-2 mb-2 leading-relaxed">
            {shader.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {shader.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-forge-text2/50 text-xs font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>
          <span className="text-forge-text2/40 text-xs font-mono flex-shrink-0">
            {timeAgo}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
