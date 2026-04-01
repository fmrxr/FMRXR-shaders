import { listShaders } from '@/services/supabase';
import { GalleryGrid } from './GalleryGrid';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Shaders — GLSL Forge',
  description: 'Browse public shaders created with GLSL Forge',
};

export const revalidate = 60;

export default async function ExplorePage() {
  const shaders = await listShaders().catch(() => []);

  return (
    <div className="min-h-screen bg-forge-bg text-forge-text">
      {/* Header */}
      <header className="border-b border-forge-border px-6 py-4 flex items-center gap-4">
        <a href="/" className="font-sans font-extrabold text-xl bg-gradient-to-r from-forge-accent to-forge-accent2 bg-clip-text text-transparent">
          GLSL Forge
        </a>
        <nav className="flex gap-4 ml-4">
          <a href="/explore" className="text-forge-text text-sm font-medium">Explore</a>
          <a href="/" className="text-forge-text2 text-sm hover:text-forge-text transition-colors">Editor</a>
        </nav>
        <div className="flex-1" />
        <a
          href="/"
          className="px-4 py-1.5 bg-gradient-to-r from-forge-accent to-forge-accent2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
        >
          Open Editor
        </a>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-sans font-bold mb-2">Explore</h1>
          <p className="text-forge-text2">
            {shaders.length} public shaders
          </p>
        </div>
        <GalleryGrid shaders={shaders} />
      </main>
    </div>
  );
}
