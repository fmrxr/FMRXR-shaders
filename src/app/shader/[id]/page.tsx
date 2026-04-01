import { getShader } from '@/services/supabase';
import { ShaderViewer } from './ShaderViewer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shader = await getShader(params.id).catch(() => null);
  return {
    title: shader ? `${shader.title} — GLSL Forge` : 'Shader — GLSL Forge',
    description: shader?.description ?? 'View this shader on GLSL Forge',
  };
}

export default async function ShaderPage({ params }: Props) {
  const shader = await getShader(params.id);
  if (!shader || !shader.isPublic) notFound();
  return <ShaderViewer project={shader} />;
}
