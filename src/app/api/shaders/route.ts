import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const tag    = searchParams.get('tag');
  const limit  = parseInt(searchParams.get('limit') ?? '50');
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabase
    .from('shader_projects')
    .select('id, title, description, tags, thumbnail, is_public, created_at, updated_at, user_id')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('is_public', true);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, tags, buffers, uniforms, isPublic, userId } = body;

    if (!title || !buffers?.length) {
      return NextResponse.json({ error: 'title and buffers are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('shader_projects')
      .insert({
        title,
        description: description ?? '',
        tags: tags ?? [],
        buffers,
        uniforms: uniforms ?? [],
        is_public: isPublic ?? false,
        user_id: userId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
