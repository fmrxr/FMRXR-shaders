import { createClient } from '@supabase/supabase-js';
import type { ShaderProject } from '@/types';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── Shader CRUD ──────────────────────────────────────────────────────

export async function listShaders(userId?: string): Promise<ShaderProject[]> {
  let query = supabase
    .from('shader_projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToProject);
}

export async function getShader(id: string): Promise<ShaderProject | null> {
  const { data, error } = await supabase
    .from('shader_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return rowToProject(data);
}

export async function saveShader(
  project: Omit<ShaderProject, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<ShaderProject> {
  const row = projectToRow(project);

  if (id) {
    const { data, error } = await supabase
      .from('shader_projects')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToProject(data);
  }

  const { data, error } = await supabase
    .from('shader_projects')
    .insert({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data);
}

export async function deleteShader(id: string): Promise<void> {
  const { error } = await supabase.from('shader_projects').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateShader(id: string): Promise<ShaderProject> {
  const original = await getShader(id);
  if (!original) throw new Error('Shader not found');
  return saveShader({
    ...original,
    title: original.title + ' (copy)',
    isPublic: false,
  });
}

// ─── Thumbnail upload ─────────────────────────────────────────────────

export async function uploadThumbnail(
  shaderId: string,
  canvas: HTMLCanvasElement
): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { resolve(null); return; }
      const path = `thumbnails/${shaderId}.png`;
      const { error } = await supabase.storage
        .from('shader-assets')
        .upload(path, blob, { upsert: true, contentType: 'image/png' });

      if (error) { resolve(null); return; }

      const { data } = supabase.storage.from('shader-assets').getPublicUrl(path);
      resolve(data.publicUrl);
    }, 'image/png');
  });
}

// ─── Row mappers ──────────────────────────────────────────────────────

function rowToProject(row: any): ShaderProject {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description ?? '',
    tags:        row.tags ?? [],
    buffers:     row.buffers ?? [],
    uniforms:    row.uniforms ?? [],
    isPublic:    row.is_public ?? false,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    userId:      row.user_id,
    thumbnail:   row.thumbnail,
  };
}

function projectToRow(p: Omit<ShaderProject, 'id' | 'createdAt' | 'updatedAt'>) {
  return {
    title:       p.title,
    description: p.description,
    tags:        p.tags,
    buffers:     p.buffers,
    uniforms:    p.uniforms,
    is_public:   p.isPublic,
    user_id:     p.userId,
    thumbnail:   p.thumbnail,
  };
}
