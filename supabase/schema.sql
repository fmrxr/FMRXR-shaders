-- ═══════════════════════════════════════════════════════════════
-- GLSL Forge — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- shader_projects
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shader_projects (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete set null,

  title        text not null default 'Untitled Shader',
  description  text not null default '',
  tags         text[] not null default '{}',

  -- JSONB columns store the entire buffer + uniform config
  buffers      jsonb not null default '[]'::jsonb,
  uniforms     jsonb not null default '[]'::jsonb,

  is_public    boolean not null default false,
  thumbnail    text,  -- URL to thumbnail image in storage

  view_count   integer not null default 0,
  like_count   integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists idx_shader_projects_user_id   on public.shader_projects(user_id);
create index if not exists idx_shader_projects_is_public on public.shader_projects(is_public);
create index if not exists idx_shader_projects_updated   on public.shader_projects(updated_at desc);
create index if not exists idx_shader_projects_tags      on public.shader_projects using gin(tags);

-- ──────────────────────────────────────────────────────────────
-- shader_versions (optional version history)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shader_versions (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.shader_projects(id) on delete cascade,
  version      integer not null default 1,

  buffers      jsonb not null default '[]'::jsonb,
  uniforms     jsonb not null default '[]'::jsonb,
  message      text,  -- commit-style message

  created_at   timestamptz not null default now()
);

create index if not exists idx_shader_versions_project on public.shader_versions(project_id, version desc);

-- ──────────────────────────────────────────────────────────────
-- shader_likes
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shader_likes (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.shader_projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

-- ──────────────────────────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────────────────────────
alter table public.shader_projects enable row level security;
alter table public.shader_versions  enable row level security;
alter table public.shader_likes     enable row level security;

-- Public shaders visible to everyone
create policy "Public shaders are viewable by all"
  on public.shader_projects for select
  using (is_public = true);

-- Owners can see their own private shaders
create policy "Users can view own shaders"
  on public.shader_projects for select
  using (auth.uid() = user_id);

-- Owners can insert
create policy "Users can insert own shaders"
  on public.shader_projects for insert
  with check (auth.uid() = user_id or user_id is null);

-- Owners can update
create policy "Users can update own shaders"
  on public.shader_projects for update
  using (auth.uid() = user_id);

-- Owners can delete
create policy "Users can delete own shaders"
  on public.shader_projects for delete
  using (auth.uid() = user_id);

-- Versions: same as parent
create policy "Versions follow project access"
  on public.shader_versions for select
  using (
    exists (
      select 1 from public.shader_projects p
      where p.id = project_id
        and (p.is_public = true or p.user_id = auth.uid())
    )
  );

create policy "Users can manage own versions"
  on public.shader_versions for all
  using (
    exists (
      select 1 from public.shader_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Likes: authenticated users
create policy "Users can like public shaders"
  on public.shader_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can view likes"
  on public.shader_likes for select
  using (true);

create policy "Users can remove own likes"
  on public.shader_likes for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- Triggers: auto-update updated_at
-- ──────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_shader_projects_updated
  before update on public.shader_projects
  for each row execute function public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Trigger: keep like_count in sync
-- ──────────────────────────────────────────────────────────────
create or replace function public.sync_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.shader_projects set like_count = like_count + 1 where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update public.shader_projects set like_count = like_count - 1 where id = old.project_id;
  end if;
  return null;
end;
$$;

create trigger trg_like_count
  after insert or delete on public.shader_likes
  for each row execute function public.sync_like_count();

-- ──────────────────────────────────────────────────────────────
-- Storage bucket for thumbnails & exports
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('shader-assets', 'shader-assets', true)
on conflict do nothing;

create policy "Public read shader assets"
  on storage.objects for select
  using (bucket_id = 'shader-assets');

create policy "Authenticated users can upload shader assets"
  on storage.objects for insert
  with check (bucket_id = 'shader-assets' and auth.role() = 'authenticated');

-- ──────────────────────────────────────────────────────────────
-- Seed: example public shaders
-- ──────────────────────────────────────────────────────────────
insert into public.shader_projects (title, description, tags, buffers, uniforms, is_public)
values
  (
    'Plasma Wave',
    'Classic plasma effect using sine waves with customizable speed and scale.',
    array['plasma', 'wave', 'color'],
    '[{"id":"image","label":"Image","code":"precision highp float;\nuniform float iTime;\nuniform vec2 iResolution;\nuniform float u_speed;\nuniform float u_scale;\nvoid main(){\n  vec2 uv=(gl_FragCoord.xy/iResolution.xy)*2.0-1.0;\n  uv.x*=iResolution.x/iResolution.y;\n  float v=sin(uv.x*u_scale+iTime*u_speed)+sin(uv.y*u_scale+iTime*0.73)+sin((uv.x+uv.y)*u_scale*0.5+iTime*1.3)+sin(length(uv)*u_scale*2.0-iTime);\n  vec3 col=0.5+0.5*cos(v+vec3(0.0,2.094,4.189));\n  gl_FragColor=vec4(col,1.0);\n}","channels":[null,null,null,null]}]'::jsonb,
    '[{"name":"u_speed","type":"float","value":1.5,"min":0.1,"max":5.0,"label":"Speed"},{"name":"u_scale","type":"float","value":2.0,"min":0.5,"max":8.0,"label":"Scale"}]'::jsonb,
    true
  )
on conflict do nothing;
