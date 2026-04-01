import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-forge-bg text-forge-text">
      <div className="text-center">
        <div className="text-8xl font-mono font-black text-forge-accent/20 mb-4">404</div>
        <h1 className="text-2xl font-bold font-sans mb-2">Shader not found</h1>
        <p className="text-forge-text2 font-mono text-sm mb-8">
          This shader doesn&apos;t exist or is private.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-gradient-to-r from-forge-accent to-forge-accent2 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Open Editor
        </Link>
      </div>
    </div>
  );
}
