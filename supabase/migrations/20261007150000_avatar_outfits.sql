-- NOT APPLIED. Drafted 2026-10-07 for the Bitmoji-kast account sync; review before applying.
-- The app works without this table: lib/avatar/outfitSync.ts falls back to local-only
-- (AsyncStorage) with a single console warning when the table/RPC is missing.
--
-- One row per user with the saved wardrobe outfit. `unlocked_item_ids` are MOCK unlocks
-- (no payment is involved anywhere); they are private to the owner and never exposed to friends.
create table public.sx_avatar_outfits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  outfit jsonb not null,
  unlocked_item_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint sx_avatar_outfits_outfit_object check (jsonb_typeof(outfit) = 'object'),
  constraint sx_avatar_outfits_outfit_size check (pg_column_size(outfit) <= 8192),
  constraint sx_avatar_outfits_unlocked_count check (cardinality(unlocked_item_ids) <= 500),
  constraint sx_avatar_outfits_unlocked_ids check (
    array_to_string(unlocked_item_ids, ',') ~ '^([a-z0-9-]{1,80}(,[a-z0-9-]{1,80})*)?$')
);

-- Clients send their own save time (newest save wins when devices reconcile); never accept
-- timestamps from the far future, which would make a row impossible to overwrite.
create function app_private.sx_avatar_outfits_clamp_time() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at is null or new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function app_private.sx_avatar_outfits_clamp_time() from public, anon, authenticated;
create trigger sx_avatar_outfits_clamp_time before insert or update on public.sx_avatar_outfits
  for each row execute function app_private.sx_avatar_outfits_clamp_time();

alter table public.sx_avatar_outfits enable row level security;
revoke all on public.sx_avatar_outfits from public, anon, authenticated;
-- PostgREST upserts (on_conflict=user_id) also SET user_id = excluded.user_id, hence the update
-- grant on user_id; the update policy's WITH CHECK keeps it equal to auth.uid().
grant select, insert (user_id, outfit, unlocked_item_ids, updated_at),
  update (user_id, outfit, unlocked_item_ids, updated_at) on public.sx_avatar_outfits to authenticated;

-- Owner only: read, create and update (upsert) the own row. No delete grant: the row goes
-- away with the account (on delete cascade).
create policy sx_avatar_outfits_own_read on public.sx_avatar_outfits for select to authenticated
  using (user_id = (select auth.uid()));
create policy sx_avatar_outfits_own_insert on public.sx_avatar_outfits for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sx_avatar_outfits_own_update on public.sx_avatar_outfits for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Banned accounts are locked out like every other user table (helper lives in staff-moderation.sql).
do $$
begin
  if to_regprocedure('app_private.sx_request_is_banned()') is not null then
    execute 'create policy sx_active_ban_guard on public.sx_avatar_outfits as restrictive for all to authenticated '
      || 'using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned())';
  end if;
end $$;

-- Friends: safe read of outfit + updated_at only (RLS cannot hide columns, and the unlock list
-- is private). Self or accepted, unblocked friends; at most 200 ids per call.
create function public.sx_friend_avatar_outfits(p_user_ids uuid[])
returns table (user_id uuid, outfit jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare banned boolean := false;
begin
  if (select auth.uid()) is null or p_user_ids is null or cardinality(p_user_ids) > 200 then return; end if;
  -- Security definer bypasses RLS (incl. the restrictive ban guard), so check bans explicitly.
  if to_regprocedure('app_private.sx_request_is_banned()') is not null then
    execute 'select app_private.sx_request_is_banned()' into banned;
    if banned then return; end if;
  end if;
  return query
    select o.user_id, o.outfit, o.updated_at
    from public.sx_avatar_outfits o
    where o.user_id = any (p_user_ids)
      and (
        o.user_id = (select auth.uid())
        or (exists (select 1 from public.sx_friends f
                    where f.user_id = (select auth.uid()) and f.friend_id = o.user_id)
            and not app_private.sx_blocked_with(o.user_id))
      );
end $$;
revoke all on function public.sx_friend_avatar_outfits(uuid[]) from public, anon;
grant execute on function public.sx_friend_avatar_outfits(uuid[]) to authenticated;
