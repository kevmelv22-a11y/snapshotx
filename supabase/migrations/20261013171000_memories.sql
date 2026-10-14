-- Step 7 (Herinneringen). NOT APPLIED. `public.memories` exists only as a legacy table in the live project
-- (referenced by account deletion); create it if missing and add the new columns.
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('photo','video')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.memories
  add column if not exists caption text check (char_length(caption) <= 500),
  add column if not exists source text not null default 'snap' check (source in ('snap','story','camera_roll')),
  add column if not exists private boolean not null default false;
create index if not exists memories_owner_created on public.memories(owner_id, created_at desc) where deleted_at is null;

alter table public.memories enable row level security;
revoke all on public.memories from public, anon;
grant select, insert, update on public.memories to authenticated;
drop policy if exists memories_owner on public.memories;
create policy memories_owner on public.memories for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 'Alleen voor mij' PIN: only a salted hash (computed on device) is stored; never the PIN.
create table if not exists public.sx_memory_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  updated_at timestamptz not null default now()
);
alter table public.sx_memory_vault enable row level security;
revoke all on public.sx_memory_vault from public, anon;
grant select, insert, update, delete on public.sx_memory_vault to authenticated;
create policy sx_memory_vault_self on public.sx_memory_vault for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- NOTE: media for private memories still lives in the shared media bucket; true at-rest encryption is out of scope.

-- Memories and re-sent snaps share Storage paths: never let expired-snap cleanup delete media a memory still uses.
create or replace function public.sx_expired_media_paths(p_limit integer default 200)
returns table(media_path text)
language sql stable security invoker set search_path = '' as $$
  select candidate.media_path
  from (
    select m.media_path from public.sx_messages m
    where m.media_path is not null and m.media_deleted_at is null and m.expires_at < now()
    union
    select s.media_path from public.sx_stories s
    where s.media_deleted_at is null and s.expires_at < now()
  ) candidate
  where not exists (
    select 1 from public.sx_messages active
    where active.media_path = candidate.media_path
      and (active.expires_at is null or active.expires_at >= now())
  ) and not exists (
    select 1 from public.sx_stories active
    where active.media_path = candidate.media_path and active.expires_at >= now()
  ) and not exists (
    select 1 from public.memories mem where mem.storage_path = candidate.media_path and mem.deleted_at is null
  )
  order by candidate.media_path
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.sx_expired_media_paths(integer) from public, anon, authenticated;
grant execute on function public.sx_expired_media_paths(integer) to service_role;
