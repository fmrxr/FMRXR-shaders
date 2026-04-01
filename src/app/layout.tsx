import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GLSL Forge — Shader Creation Platform',
  description: 'Create, edit, and export real-time GLSL shaders. Multi-pass rendering, live uniforms, WebGL2.',
  keywords: ['GLSL', 'shader', 'WebGL', 'fragment shader', 'creative coding'],
  openGraph: {
    title: 'GLSL Forge',
    description: 'Professional shader creation platform',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-screen overflow-hidden bg-forge-bg text-forge-text antialiased">
        {children}
      </body>
    </html>
  );
}
