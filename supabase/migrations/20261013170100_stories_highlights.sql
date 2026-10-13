-- Step 5: Stories viewer + public vertical feed ("Uitgelicht"). NOT APPLIED. Review before running.
-- Story views/reactions already exist (schema.sql). This adds indexes, likes/shares and a feed RPC.
create index if not exists sx_story_views_story_idx on public.sx_story_views(story_id, viewed_at desc);
create index if not exists sx_stories_public_idx on public.sx_stories(visibility, expires_at desc);

create table if not exists public.sx_highlight_likes (
  story_id uuid not null references public.sx_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(story_id,user_id)
);
create table if not exists public.sx_highlight_shares (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.sx_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sx_highlight_likes enable row level security;
alter table public.sx_highlight_shares enable row level security;

-- Only public, active stories can be liked/shared; users manage only their own rows.
create policy sx_highlight_likes_read on public.sx_highlight_likes for select to authenticated using (user_id = auth.uid());
create policy sx_highlight_likes_insert on public.sx_highlight_likes for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.sx_stories s where s.id = story_id and s.visibility = 'everyone' and s.expires_at > now()));
create policy sx_highlight_likes_delete on public.sx_highlight_likes for delete to authenticated using (user_id = auth.uid());
create policy sx_highlight_shares_insert on public.sx_highlight_shares for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.sx_stories s where s.id = story_id and s.visibility = 'everyone' and s.expires_at > now()));

-- Feed with aggregate counters (counts only, no liker identities). Excludes blocked users both ways.
create or replace function public.sx_highlight_feed(p_limit int default 60)
returns table(id uuid, owner_id uuid, media_path text, media_type text, caption text, created_at timestamptz,
              likes bigint, shares bigint, views bigint, liked boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.owner_id, s.media_path, s.media_type, s.caption, s.created_at,
    (select count(*) from sx_highlight_likes l where l.story_id = s.id),
    (select count(*) from sx_highlight_shares h where h.story_id = s.id),
    (select count(*) from sx_story_views v where v.story_id = s.id),
    exists(select 1 from sx_highlight_likes l where l.story_id = s.id and l.user_id = auth.uid())
  from sx_stories s
  where s.visibility = 'everyone' and s.expires_at > now()
    and not exists(select 1 from sx_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = s.owner_id) or (b.blocker_id = s.owner_id and b.blocked_id = auth.uid()))
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.sx_highlight_feed(int) from public, anon;
grant execute on function public.sx_highlight_feed(int) to authenticated;
