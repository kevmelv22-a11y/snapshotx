-- Run after snap-access.sql. Adds bookkeeping so the cleanup-media Edge
-- Function can find expired media exactly once and not repeatedly rescan
-- everything. NOT YET APPLIED — review and run this yourself.

alter table public.sx_messages add column if not exists media_deleted_at timestamptz;
alter table public.sx_stories add column if not exists media_deleted_at timestamptz;
create index if not exists sx_messages_cleanup on public.sx_messages(expires_at) where media_path is not null and media_deleted_at is null;
create index if not exists sx_stories_cleanup on public.sx_stories(expires_at) where media_deleted_at is null;
create index if not exists sx_messages_media_refs on public.sx_messages(media_path) where media_path is not null;
create index if not exists sx_stories_media_refs on public.sx_stories(media_path);

-- A single Storage path can be referenced by more than one snap. Never delete
-- it while *any* message or story still has an active reference.
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
  )
  order by candidate.media_path
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.sx_expired_media_paths(integer) from public, anon, authenticated;
grant execute on function public.sx_expired_media_paths(integer) to service_role;

-- The cleanup function runs as the service role, which already bypasses RLS,
-- so no special grants are needed for it to read/update these tables. It
-- only ever touches rows whose expires_at is already in the past.
