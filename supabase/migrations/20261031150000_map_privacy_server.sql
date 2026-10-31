-- Snap Map privacy on the server: audience (all / selected / none), timed + permanent ghost mode and a
-- selected-friends allow list (app/map.tsx, lib/map-privacy.ts).
-- Supersedes the never-applied 20261013170000_map_sharing_ghost.sql: that draft would have replaced the live,
-- hardened friends policy (self excluded, block-aware app_private.sx_is_friend) with a weaker raw sx_friends check
-- and had a non-idempotent create policy. Do NOT apply 20261013170000 after this one.
-- Safe to re-run.

alter table public.sx_locations
  add column if not exists share_audience text not null default 'none',
  add column if not exists ghost_until timestamptz,
  add column if not exists ghost_forever boolean not null default false;

do $$ begin
  alter table public.sx_locations add constraint sx_locations_share_audience_check
    check (share_audience in ('all', 'selected', 'none'));
exception when duplicate_object then null; end $$;

-- Existing rows: whoever was sharing keeps sharing with all friends (same visibility as before).
update public.sx_locations set share_audience = 'all' where sharing and share_audience = 'none';

-- Older app builds only write `sharing`. Keep audience consistent so they are not silently hidden/exposed:
--  * a row that turns sharing on without choosing an audience shares with all friends (old behaviour);
--  * a row that turns sharing off without choosing an audience becomes 'none'.
create or replace function app_private.sx_locations_audience_compat() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.sharing and new.share_audience = 'none' then new.share_audience := 'all'; end if;
  elsif new.share_audience is not distinct from old.share_audience then
    if new.sharing and not old.sharing and new.share_audience = 'none' then new.share_audience := 'all'; end if;
    if not new.sharing and old.sharing then new.share_audience := 'none'; end if;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_locations_audience_compat() from public, anon, authenticated;
drop trigger if exists sx_locations_audience_compat on public.sx_locations;
create trigger sx_locations_audience_compat before insert or update on public.sx_locations
  for each row execute function app_private.sx_locations_audience_compat();

-- Allow list for audience = 'selected'. Owner-only; friend_id must be a current, unblocked friend.
create table if not exists public.sx_location_allowed (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint sx_location_allowed_not_self check (owner_id <> friend_id)
);
create index if not exists sx_location_allowed_friend_idx on public.sx_location_allowed (friend_id);
alter table public.sx_location_allowed enable row level security;
revoke all on public.sx_location_allowed from public, anon, authenticated;
grant select, delete on public.sx_location_allowed to authenticated;
grant insert (owner_id, friend_id) on public.sx_location_allowed to authenticated;

drop policy if exists sx_location_allowed_owner_read on public.sx_location_allowed;
create policy sx_location_allowed_owner_read on public.sx_location_allowed for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sx_location_allowed_owner_insert on public.sx_location_allowed;
create policy sx_location_allowed_owner_insert on public.sx_location_allowed for insert to authenticated
  with check (owner_id = (select auth.uid()) and app_private.sx_is_friend(friend_id));
drop policy if exists sx_location_allowed_owner_delete on public.sx_location_allowed;
create policy sx_location_allowed_owner_delete on public.sx_location_allowed for delete to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sx_active_ban_guard on public.sx_location_allowed;
create policy sx_active_ban_guard on public.sx_location_allowed as restrictive for all to authenticated
  using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned());

-- Friends' read: keep every live condition (not self, sharing, fresh 24 h, block-aware friend) and add
-- ghost mode + audience. Timed ghost mode ends on the server without the owner's app coming back online.
-- The allow-list lookup is a security definer helper: readers cannot (and must not) select other people's lists.
create or replace function app_private.sx_location_allowed_for_me(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sx_location_allowed a
                 where a.owner_id = p_owner and a.friend_id = (select auth.uid()));
$$;
revoke all on function app_private.sx_location_allowed_for_me(uuid) from public, anon;
grant execute on function app_private.sx_location_allowed_for_me(uuid) to authenticated;

drop policy if exists sx_locations_friends on public.sx_locations;
create policy sx_locations_friends on public.sx_locations for select to authenticated using (
  user_id <> (select auth.uid())
  and sharing = true
  and updated_at > now() - interval '24 hours'
  and not ghost_forever
  and (ghost_until is null or ghost_until <= now())
  and app_private.sx_is_friend(user_id)
  and (share_audience = 'all'
       or (share_audience = 'selected' and app_private.sx_location_allowed_for_me(user_id)))
);
