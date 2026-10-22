-- Spotlight ("Uitgelicht") social layer, Snapchat-style: comments (Reacties), comment likes and subscribing to
-- creators (Abonneren) + subscriber count in the feed. NOT APPLIED. Review before running.
-- The app degrades gracefully without it: the feed still loads, comment/subscribe calls show a friendly error.

create table if not exists public.sx_highlight_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.sx_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 150),
  created_at timestamptz not null default now()
);
create index if not exists sx_highlight_comments_story_idx on public.sx_highlight_comments(story_id, created_at desc);

create table if not exists public.sx_highlight_comment_likes (
  comment_id uuid not null references public.sx_highlight_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(comment_id, user_id)
);

create table if not exists public.sx_creator_subscriptions (
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(subscriber_id, creator_id),
  check (subscriber_id <> creator_id)
);
create index if not exists sx_creator_subscriptions_creator_idx on public.sx_creator_subscriptions(creator_id);

alter table public.sx_highlight_comments enable row level security;
alter table public.sx_highlight_comment_likes enable row level security;
alter table public.sx_creator_subscriptions enable row level security;

-- A comment is visible on public, active snaps, unless author/reader blocked each other.
create or replace function public.sx_can_see_highlight_comment(p_story uuid, p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from sx_stories s where s.id = p_story and s.visibility = 'everyone' and s.expires_at > now())
    and not exists(select 1 from sx_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p_author) or (b.blocker_id = p_author and b.blocked_id = auth.uid()));
$$;
revoke all on function public.sx_can_see_highlight_comment(uuid, uuid) from public, anon;
grant execute on function public.sx_can_see_highlight_comment(uuid, uuid) to authenticated;

create policy sx_highlight_comments_read on public.sx_highlight_comments for select to authenticated
  using (public.sx_can_see_highlight_comment(story_id, user_id));
create policy sx_highlight_comments_insert on public.sx_highlight_comments for insert to authenticated
  with check (user_id = auth.uid() and public.sx_can_see_highlight_comment(story_id, user_id));
-- Author or the snap's owner may delete (Snapchat: creators moderate their own comments).
create policy sx_highlight_comments_delete on public.sx_highlight_comments for delete to authenticated
  using (user_id = auth.uid() or exists(select 1 from public.sx_stories s where s.id = story_id and s.owner_id = auth.uid()));

create policy sx_highlight_comment_likes_read on public.sx_highlight_comment_likes for select to authenticated
  using (exists(select 1 from public.sx_highlight_comments c where c.id = comment_id));
create policy sx_highlight_comment_likes_insert on public.sx_highlight_comment_likes for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.sx_highlight_comments c where c.id = comment_id));
create policy sx_highlight_comment_likes_delete on public.sx_highlight_comment_likes for delete to authenticated using (user_id = auth.uid());

-- Only your own subscriptions are readable; counts come from the feed RPC.
create policy sx_creator_subscriptions_read on public.sx_creator_subscriptions for select to authenticated using (subscriber_id = auth.uid());
create policy sx_creator_subscriptions_insert on public.sx_creator_subscriptions for insert to authenticated with check (subscriber_id = auth.uid());
create policy sx_creator_subscriptions_delete on public.sx_creator_subscriptions for delete to authenticated using (subscriber_id = auth.uid());

grant select, insert, delete on public.sx_highlight_comments, public.sx_highlight_comment_likes, public.sx_creator_subscriptions to authenticated;

-- Feed RPC gains the creator's subscriber count (return type changes → drop + recreate).
drop function if exists public.sx_highlight_feed(int);
create function public.sx_highlight_feed(p_limit int default 60)
returns table(id uuid, owner_id uuid, media_path text, media_type text, caption text, created_at timestamptz,
              likes bigint, shares bigint, views bigint, liked boolean, subscribers bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.owner_id, s.media_path, s.media_type, s.caption, s.created_at,
    (select count(*) from sx_highlight_likes l where l.story_id = s.id),
    (select count(*) from sx_highlight_shares h where h.story_id = s.id),
    (select count(*) from sx_story_views v where v.story_id = s.id),
    exists(select 1 from sx_highlight_likes l where l.story_id = s.id and l.user_id = auth.uid()),
    (select count(*) from sx_creator_subscriptions c where c.creator_id = s.owner_id)
  from sx_stories s
  where s.visibility = 'everyone' and s.expires_at > now()
    and not exists(select 1 from sx_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = s.owner_id) or (b.blocker_id = s.owner_id and b.blocked_id = auth.uid()))
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.sx_highlight_feed(int) from public, anon;
grant execute on function public.sx_highlight_feed(int) to authenticated;
