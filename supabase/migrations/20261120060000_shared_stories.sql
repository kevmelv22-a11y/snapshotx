-- Gedeeld verhaal (Snapchat shared / group story): a story that only the chosen members can see and add to.
-- Members are added through security-definer RPCs (friends of the person adding, never blocked, max 30).
-- sx_stories.shared_story_id: null = normal story (unchanged rules); set = visible to members only, never public.

create table if not exists public.sx_shared_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 40),
  -- set null (not cascade): the creator deleting their account must not delete the shared story, because that would
  -- detach the other members' snaps (shared_story_id -> null) and turn them into normal friends stories.
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.sx_shared_story_members (
  shared_story_id uuid not null references public.sx_shared_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (shared_story_id, user_id)
);
create index if not exists sx_shared_story_members_user_idx on public.sx_shared_story_members(user_id);
-- on delete set null: rows are always expired first (leave), so a detached row never becomes a visible normal story.
alter table public.sx_stories add column if not exists shared_story_id uuid references public.sx_shared_stories(id) on delete set null;
create index if not exists sx_stories_shared_idx on public.sx_stories(shared_story_id) where shared_story_id is not null;
do $$ begin
  alter table public.sx_stories add constraint sx_stories_shared_private check (shared_story_id is null or visibility = 'friends');
exception when duplicate_object then null; end $$;

create or replace function app_private.sx_is_shared_member(p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_id is null then return false; end if;
  return exists (select 1 from public.sx_shared_story_members m where m.shared_story_id = p_id and m.user_id = (select auth.uid()));
end $$;
revoke all on function app_private.sx_is_shared_member(uuid) from public, anon;
grant execute on function app_private.sx_is_shared_member(uuid) to authenticated;

alter table public.sx_shared_stories enable row level security;
alter table public.sx_shared_story_members enable row level security;
drop policy if exists sx_shared_stories_read on public.sx_shared_stories;
create policy sx_shared_stories_read on public.sx_shared_stories for select to authenticated using (app_private.sx_is_shared_member(id));
drop policy if exists sx_shared_story_members_read on public.sx_shared_story_members;
create policy sx_shared_story_members_read on public.sx_shared_story_members for select to authenticated using (app_private.sx_is_shared_member(shared_story_id));
drop policy if exists sx_active_ban_guard on public.sx_shared_stories;
create policy sx_active_ban_guard on public.sx_shared_stories as restrictive for all to authenticated using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned());
drop policy if exists sx_active_ban_guard on public.sx_shared_story_members;
create policy sx_active_ban_guard on public.sx_shared_story_members as restrictive for all to authenticated using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned());
revoke all on public.sx_shared_stories, public.sx_shared_story_members from anon, authenticated;
grant select on public.sx_shared_stories, public.sx_shared_story_members to authenticated;

-- Stories: shared ones only for members (and the owner); normal stories keep the old friends / everyone rule.
drop policy if exists sx_stories_read on public.sx_stories;
create policy sx_stories_read on public.sx_stories for select to authenticated using (
  (not app_private.sx_blocked_with(owner_id)) and (
    owner_id = (select auth.uid())
    or (expires_at > now() and (
      (shared_story_id is null and (visibility = 'everyone' or exists (select 1 from public.sx_friends where sx_friends.user_id = (select auth.uid()) and sx_friends.friend_id = sx_stories.owner_id)))
      or (shared_story_id is not null and app_private.sx_is_shared_member(shared_story_id))))));
drop policy if exists sx_stories_write on public.sx_stories;
create policy sx_stories_write on public.sx_stories for insert to authenticated with check (
  owner_id = auth.uid() and split_part(media_path, '/', 1) = (auth.uid())::text and expires_at <= now() + interval '24 hours'
  and (shared_story_id is null or app_private.sx_is_shared_member(shared_story_id)));
drop policy if exists sx_stories_update on public.sx_stories;
create policy sx_stories_update on public.sx_stories for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (shared_story_id is null or app_private.sx_is_shared_member(shared_story_id)));

-- Add friends (of the caller) to a shared story the caller is in. Returns how many were added.
create or replace function app_private.sx_shared_story_add(p_id uuid, p_members uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_count int; v_new uuid[]; target uuid;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.sx_shared_story_members m where m.shared_story_id = p_id and m.user_id = uid) then raise exception 'Not a member of this shared story'; end if;
  select array_agg(distinct x) into v_new from unnest(coalesce(p_members, '{}')) x
   where x is not null and x <> uid and not exists (select 1 from public.sx_shared_story_members m where m.shared_story_id = p_id and m.user_id = x);
  v_new := coalesce(v_new, '{}');
  select count(*) into v_count from public.sx_shared_story_members where shared_story_id = p_id;
  if v_count + cardinality(v_new) > 30 then raise exception 'Shared story is full (max 30)'; end if;
  foreach target in array v_new loop
    if not exists (select 1 from public.sx_friends f where f.user_id = uid and f.friend_id = target) then raise exception 'Only friends can be added'; end if;
    if exists (select 1 from public.sx_blocks b where (b.blocker_id = uid and b.blocked_id = target) or (b.blocker_id = target and b.blocked_id = uid)) then raise exception 'Only friends can be added'; end if;
    insert into public.sx_shared_story_members(shared_story_id, user_id, added_by) values (p_id, target, uid) on conflict do nothing;
  end loop;
  return cardinality(v_new);
end $$;
revoke all on function app_private.sx_shared_story_add(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.sx_create_shared_story(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_id uuid;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 40 then raise exception 'Invalid shared story name'; end if;
  if coalesce(cardinality(p_members), 0) = 0 then raise exception 'Choose at least one friend'; end if;
  insert into public.sx_shared_stories(title, created_by) values (btrim(p_title), uid) returning id into v_id;
  insert into public.sx_shared_story_members(shared_story_id, user_id, added_by) values (v_id, uid, uid);
  perform app_private.sx_shared_story_add(v_id, p_members);
  return v_id;
end $$;
revoke all on function public.sx_create_shared_story(text, uuid[]) from public, anon;
grant execute on function public.sx_create_shared_story(text, uuid[]) to authenticated;

create or replace function public.sx_add_shared_story_members(p_id uuid, p_members uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  return app_private.sx_shared_story_add(p_id, p_members);
end $$;
revoke all on function public.sx_add_shared_story_members(uuid, uuid[]) from public, anon;
grant execute on function public.sx_add_shared_story_members(uuid, uuid[]) to authenticated;

-- Leave: your own snaps in it are soft-deleted (same as Verhaal verwijderen, media cleanup keeps working); the last member leaving deletes the shared story.
create or replace function public.sx_leave_shared_story(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Sign in required'; end if;
  delete from public.sx_shared_story_members where shared_story_id = p_id and user_id = uid;
  if not found then raise exception 'Not a member of this shared story'; end if;
  update public.sx_stories set removed_at = now(), expires_at = least(expires_at, now()) where shared_story_id = p_id and owner_id = uid;
  if not exists (select 1 from public.sx_shared_story_members where shared_story_id = p_id) then
    update public.sx_stories set removed_at = coalesce(removed_at, now()), expires_at = least(expires_at, now()) where shared_story_id = p_id;
    delete from public.sx_shared_stories where id = p_id;
  end if;
end $$;
revoke all on function public.sx_leave_shared_story(uuid) from public, anon;
grant execute on function public.sx_leave_shared_story(uuid) to authenticated;

-- Story media: same rule as the sx_stories_read policy above, so a friend who is NOT a member can't open the
-- media file of a Gedeeld verhaal snap (copy of 20261028180000 with only the story clause extended).
drop policy if exists sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id='snapshotx-media'
  and app_private.sx_account_active()
  and not exists(select 1 from public.sx_messages removed where removed.media_path=name and removed.media_deleted_at is not null)
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (
      select 1 from public.sx_messages m where m.media_path=name
        and app_private.sx_is_member(m.thread_id)
        and not app_private.sx_blocked_with(m.sender_id)
        and (m.expires_at is null or m.expires_at>now())
        and (not m.view_once or exists (
          select 1 from public.sx_receipts r where r.message_id=m.id and r.user_id=(select auth.uid())
            and r.opened_at>now()-interval '90 seconds'
        ))
    )
    or exists (
      select 1 from public.sx_stories s where s.media_path=name
        and not app_private.sx_blocked_with(s.owner_id)
        and (s.owner_id=(select auth.uid()) or (s.expires_at>now() and (
          (s.shared_story_id is null and (s.visibility='everyone' or exists(select 1 from public.sx_friends f where f.user_id=(select auth.uid()) and f.friend_id=s.owner_id)))
          or (s.shared_story_id is not null and app_private.sx_is_shared_member(s.shared_story_id)))))
    )
    or exists (
      select 1 from public.sx_threads t where t.wallpaper='photo' and t.wallpaper_path=name
        and app_private.sx_is_member(t.id)
    )
  )
);
