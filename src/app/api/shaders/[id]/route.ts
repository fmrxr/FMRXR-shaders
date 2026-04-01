import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { data, error } = await supabase
    .from('shader_projects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const { data, error } = await supabase
      .from('shader_projects')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = await supabase
    .from('shader_projects')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
