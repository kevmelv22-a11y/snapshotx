-- =====================================================================================================
-- NOT APPLIED. Written 2026-10-19; has NOT been run against any Supabase project (incl. live
-- udantesxduijzhhunadv). Review, then apply deliberately (SQL editor or `supabase db push`).
-- =====================================================================================================
-- Data API grants + RLS for every SnapShot X table the app uses.
--
-- Why: the iOS app on live gets `permission denied for table sx_locations / sx_stories / sx_friends`
-- (SQLSTATE 42501). That error means the `authenticated` role has no table privilege at all (RLS only
-- filters rows; it never raises 42501 on SELECT). The base sx_* tables are created by loose scripts
-- (supabase/schema.sql, map.sql, fixes.sql) that are not part of supabase/migrations, and Supabase no
-- longer grants SELECT/INSERT/UPDATE/DELETE on new public tables to anon/authenticated/service_role
-- automatically (default for new projects since 2026-05-30, enforced on all projects from 2026-10-30).
-- Every table therefore needs an explicit GRANT, and this file makes those grants explicit.
--
-- What it does (all steps idempotent; a table/column that does not exist yet is skipped with a NOTICE):
--   1. anon gets nothing on any sx_* table (the app needs a signed-in user for everything).
--   2. authenticated gets exactly the privileges the app uses (column-limited where earlier migrations
--      already limited them); service_role (Edge Functions, cron) gets full access to every table.
--   3. RLS is enabled on every table; missing policies are created with the same names as the earlier
--      scripts/migrations (an existing policy with that name is left untouched), so:
--        own rows only: preferences, push tokens, outfits, memories, vault, X+ prefs/entitlements, blocks,
--          hidden suggestions, friend list (sx_friends), friend requests you sent/received;
--        friends: stories (plus stories the owner made public), locations (see 4);
--        chat members: threads, members, messages, receipts, reactions.
--      Blocked users (sx_blocks, either direction) are excluded everywhere.
--      Rebuilt every time: sx_locations_friends (below) and sx_receipts_insert (read marks only, never
--      view-once snaps; snaps stay on sx_claim_snap).
--   4. sx_locations_friends is always (re)built: a friend sees a location only when it is shared, fresh
--      (24 h), the owner is not in ghost mode (ghost_forever / ghost_until in the future) and the
--      audience allows it ('all', or 'selected' and the viewer is on the owner's allow list). The allow
--      list check uses a SECURITY DEFINER helper because the viewer cannot read the owner's
--      sx_location_allowed rows through RLS (the old inline subquery made 'selected' never match).
--   5. public.sx_ensure_profile(): creates the caller's missing profiles row (username from the sign-up
--      metadata, else user_<8 hex of the id>) so the profile/QR screens never hit "0 rows".
--   6. Re-grants EXECUTE on the app's RPCs/helpers (only those that exist), re-applies the restrictive
--      ban guard where app_private.sx_request_is_banned() exists, and reloads the PostgREST schema cache.
--
-- It does NOT create the feature tables/columns themselves. Apply first (in this order, each is
-- idempotent or was already applied): schema.sql, map.sql, fixes.sql, snap-access.sql, and the files
-- in supabase/migrations up to 20261013210000_profile_gender.sql. See docs/engineering/LIVE_DB_CHECKLIST.md.
-- =====================================================================================================

begin;

create schema if not exists app_private;
grant usage on schema public to authenticated, service_role;
grant usage on schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------- session-local helpers (dropped at the end)
create or replace function pg_temp.sx_has_table(p_table text) returns boolean language sql as $$
  select to_regclass('public.' || p_table) is not null;
$$;

create or replace function pg_temp.sx_has_columns(p_table text, p_columns text[]) returns boolean language sql as $$
  select count(*) = cardinality(p_columns) from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name = any (p_columns);
$$;

-- Runs p_sql only when the table exists.
create or replace function pg_temp.sx_on_table(p_table text, p_sql text) returns void language plpgsql as $$
begin
  if not pg_temp.sx_has_table(p_table) then
    raise notice 'sx grants: public.% does not exist, skipped', p_table;
    return;
  end if;
  execute p_sql;
end $$;

-- Creates the policy only when the table exists and no policy with that name is there yet.
create or replace function pg_temp.sx_policy(p_table text, p_policy text, p_sql text) returns void language plpgsql as $$
begin
  if not pg_temp.sx_has_table(p_table) then
    raise notice 'sx policies: public.% does not exist, % skipped', p_table, p_policy;
    return;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = p_table and policyname = p_policy) then
    return;
  end if;
  execute format('create policy %I on public.%I ', p_policy, p_table) || p_sql;
end $$;

-- ---------------------------------------------------------------- RLS helpers (SECURITY DEFINER: no RLS recursion,
-- and they work regardless of the caller's table grants)
create or replace function app_private.sx_blocked_with(p_other uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if to_regclass('public.sx_blocks') is null then return false; end if;
  return exists (
    select 1 from public.sx_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other)
       or (b.blocked_id = (select auth.uid()) and b.blocker_id = p_other));
end $$;
revoke all on function app_private.sx_blocked_with(uuid) from public, anon;
grant execute on function app_private.sx_blocked_with(uuid) to authenticated, service_role;

-- Accepted friend (sx_friends row from the caller to p_other) and not blocked either way.
create or replace function app_private.sx_is_friend(p_other uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_other is null then return false; end if;
  if to_regclass('public.sx_friends') is null then return false; end if;
  return exists (select 1 from public.sx_friends f where f.user_id = (select auth.uid()) and f.friend_id = p_other)
     and not app_private.sx_blocked_with(p_other);
end $$;
revoke all on function app_private.sx_is_friend(uuid) from public, anon;
grant execute on function app_private.sx_is_friend(uuid) to authenticated, service_role;

-- Caller is on p_owner's selected-friends allow list for the map.
create or replace function app_private.sx_location_allows(p_owner uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if to_regclass('public.sx_location_allowed') is null then return false; end if;
  return exists (select 1 from public.sx_location_allowed a where a.owner_id = p_owner and a.friend_id = (select auth.uid()));
end $$;
revoke all on function app_private.sx_location_allows(uuid) from public, anon;
grant execute on function app_private.sx_location_allows(uuid) to authenticated, service_role;

-- Thread membership (same definition as schema.sql; plpgsql so it also compiles before sx_members exists).
create or replace function app_private.sx_is_member(t uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if to_regclass('public.sx_members') is null then return false; end if;
  return exists (select 1 from public.sx_members m where m.thread_id = t and m.user_id = (select auth.uid()));
end $$;
revoke all on function app_private.sx_is_member(uuid) from public, anon;
grant execute on function app_private.sx_is_member(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- 1 + 2. table privileges
do $$
declare
  t text;
  -- [table, privileges for authenticated ('' = none)]
  matrix text[][] := array[
    ['sx_friend_requests',         'select, insert'],
    ['sx_friends',                 'select'],
    ['sx_threads',                 'select'],
    ['sx_members',                 'select'],
    ['sx_messages',                'select, insert'],
    ['sx_receipts',                'select, insert'],            -- read marks; snaps are claimed via sx_claim_snap
    ['sx_reactions',               'select, insert, update, delete'],
    ['sx_stories',                 'select, insert, update, delete'],
    ['sx_story_views',             'select, insert, update'],
    ['sx_story_reactions',         'select, insert, update'],
    ['sx_preferences',             'select, insert, update'],
    ['sx_push_tokens',             'select, insert, update, delete'],
    ['sx_locations',               'select, insert, update, delete'],
    ['sx_location_allowed',        'select, insert, delete'],
    ['sx_highlight_likes',         'select, insert, update, delete'],
    ['sx_highlight_shares',        'insert'],
    ['sx_memory_vault',            'select, insert, update, delete'],
    ['memories',                   'select, insert, update'],
    ['sx_plus_prefs',              'select, insert, update, delete'],
    ['sx_entitlements',            'select'],
    ['sx_login_history',           'select'],                    -- staff read; RLS from the staff migration
    ['sx_staff_bans',              'select'],
    ['sx_staff_warnings',          'select'],
    ['sx_blocks',                  ''],                          -- column grants below
    ['sx_hidden_suggestions',      ''],
    ['sx_avatar_outfits',          ''],
    ['sx_reports',                 ''],
    ['sx_push_deliveries',         ''],                          -- service role only
    ['sx_push_recipient_deliveries',''],
    ['sx_purchase_events',         '']
  ];
  i int;
begin
  for i in 1 .. array_length(matrix, 1) loop
    t := matrix[i][1];
    if not pg_temp.sx_has_table(t) then
      raise notice 'sx grants: public.% does not exist, skipped', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    if matrix[i][2] <> '' then
      execute format('grant %s on public.%I to authenticated', matrix[i][2], t);
    end if;
  end loop;
end $$;

-- Column-limited grants (same as the migrations that created these tables).
select pg_temp.sx_on_table('sx_blocks', 'grant select, insert (blocker_id, blocked_id), delete on public.sx_blocks to authenticated');
select pg_temp.sx_on_table('sx_hidden_suggestions', 'grant select, insert (user_id, other_id) on public.sx_hidden_suggestions to authenticated');
select pg_temp.sx_on_table('sx_reports', 'grant select, insert (reporter_id, message_id, story_id, reason) on public.sx_reports to authenticated');
select pg_temp.sx_on_table('sx_avatar_outfits',
  'grant select, insert (user_id, outfit, unlocked_item_ids, updated_at), update (user_id, outfit, unlocked_item_ids, updated_at) on public.sx_avatar_outfits to authenticated');
do $$ begin
  if pg_temp.sx_has_columns('sx_avatar_outfits', array['pose']) then
    grant insert (pose), update (pose) on public.sx_avatar_outfits to authenticated;
  end if;
end $$;
-- Profiles: the app reads names for search/friends and edits its own display name. RLS on profiles is
-- defined outside this repo and is left as is.
select pg_temp.sx_on_table('profiles', 'grant select on public.profiles to authenticated');
select pg_temp.sx_on_table('profiles', 'grant select, insert, update, delete on public.profiles to service_role');
do $$ begin
  if pg_temp.sx_has_columns('profiles', array['display_name']) then
    grant update (display_name) on public.profiles to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------- 3. policies (created only when missing)
-- Friend requests: sender or recipient, never with a blocked user.
select pg_temp.sx_policy('sx_friend_requests', 'sx_requests_read', $p$for select to authenticated
  using ((sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
    and not app_private.sx_blocked_with(case when sender_id = (select auth.uid()) then recipient_id else sender_id end))$p$);
select pg_temp.sx_policy('sx_friend_requests', 'sx_requests_send', $p$for insert to authenticated
  with check (sender_id = (select auth.uid()) and status = 'pending' and recipient_id <> (select auth.uid())
    and not app_private.sx_blocked_with(recipient_id)
    and exists (select 1 from public.profiles pr where pr.id = recipient_id))$p$);

-- Own friend list only.
select pg_temp.sx_policy('sx_friends', 'sx_friends_read', $p$for select to authenticated
  using (user_id = (select auth.uid()) and not app_private.sx_blocked_with(friend_id))$p$);

-- Chats: members only.
select pg_temp.sx_policy('sx_threads', 'sx_threads_read', $p$for select to authenticated using (app_private.sx_is_member(id))$p$);
select pg_temp.sx_policy('sx_members', 'sx_members_read', $p$for select to authenticated using (app_private.sx_is_member(thread_id))$p$);
select pg_temp.sx_policy('sx_messages', 'sx_messages_read', $p$for select to authenticated
  using (app_private.sx_is_member(thread_id) and not app_private.sx_blocked_with(sender_id)
    and (expires_at is null or expires_at > now()))$p$);
select pg_temp.sx_policy('sx_messages', 'sx_messages_send', $p$for insert to authenticated
  with check (sender_id = (select auth.uid()) and app_private.sx_is_member(thread_id)
    and not exists (select 1 from public.sx_members member
      where member.thread_id = sx_messages.thread_id and member.user_id <> (select auth.uid())
        and app_private.sx_blocked_with(member.user_id))
    and (expires_at is null or expires_at <= now() + interval '24 hours')
    and (media_path is null or split_part(media_path, '/', 1) = (select auth.uid())::text))$p$);
select pg_temp.sx_policy('sx_receipts', 'sx_receipts_read', $p$for select to authenticated
  using (app_private.sx_is_member((select m.thread_id from public.sx_messages m where m.id = message_id)))$p$);
-- Read marks for normal messages only; view-once snaps go through sx_claim_snap (no client insert/update).
-- Always rebuilt: this file grants INSERT (snap-access.sql had revoked it), so the old schema.sql version,
-- which also accepted snap receipts, must not survive.
select pg_temp.sx_on_table('sx_receipts', 'drop policy if exists sx_receipts_insert on public.sx_receipts');
select pg_temp.sx_policy('sx_receipts', 'sx_receipts_insert', $p$for insert to authenticated
  with check (user_id = (select auth.uid()) and replay_count = 0
    and exists (select 1 from public.sx_messages m where m.id = message_id and not m.view_once
      and app_private.sx_is_member(m.thread_id)))$p$);
select pg_temp.sx_policy('sx_reactions', 'sx_reactions_read', $p$for select to authenticated
  using (app_private.sx_is_member((select m.thread_id from public.sx_messages m where m.id = message_id)))$p$);
select pg_temp.sx_policy('sx_reactions', 'sx_reactions_write', $p$for insert to authenticated
  with check (user_id = (select auth.uid()) and app_private.sx_is_member((select m.thread_id from public.sx_messages m where m.id = message_id)))$p$);
select pg_temp.sx_policy('sx_reactions', 'sx_reactions_update', $p$for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_reactions', 'sx_reactions_delete', $p$for delete to authenticated using (user_id = (select auth.uid()))$p$);

-- Stories: own, friends' active stories, or active stories the owner explicitly made public; never blocked.
select pg_temp.sx_policy('sx_stories', 'sx_stories_read', $p$for select to authenticated
  using (not app_private.sx_blocked_with(owner_id) and (owner_id = (select auth.uid())
    or (expires_at > now() and (visibility = 'everyone' or app_private.sx_is_friend(owner_id)))))$p$);
select pg_temp.sx_policy('sx_stories', 'sx_stories_write', $p$for insert to authenticated
  with check (owner_id = (select auth.uid()) and split_part(media_path, '/', 1) = (select auth.uid())::text
    and expires_at <= now() + interval '24 hours')$p$);
select pg_temp.sx_policy('sx_stories', 'sx_stories_update', $p$for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_stories', 'sx_stories_delete', $p$for delete to authenticated using (owner_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_story_views', 'sx_story_views_read', $p$for select to authenticated
  using (viewer_id = (select auth.uid()) or exists (select 1 from public.sx_stories s where s.id = story_id and s.owner_id = (select auth.uid())))$p$);
select pg_temp.sx_policy('sx_story_views', 'sx_story_views_insert', $p$for insert to authenticated
  with check (viewer_id = (select auth.uid()) and exists (select 1 from public.sx_stories s where s.id = story_id))$p$);
select pg_temp.sx_policy('sx_story_views', 'sx_story_views_update', $p$for update to authenticated
  using (viewer_id = (select auth.uid())) with check (viewer_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_story_reactions', 'sx_story_reactions_read', $p$for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.sx_stories s where s.id = story_id and s.owner_id = (select auth.uid())))$p$);
select pg_temp.sx_policy('sx_story_reactions', 'sx_story_reactions_insert', $p$for insert to authenticated
  with check (user_id = (select auth.uid()) and char_length(emoji) < 12 and exists (select 1 from public.sx_stories s where s.id = story_id))$p$);
select pg_temp.sx_policy('sx_story_reactions', 'sx_story_reactions_update', $p$for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_highlight_likes', 'sx_highlight_likes_read', $p$for select to authenticated using (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_highlight_likes', 'sx_highlight_likes_insert', $p$for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.sx_stories s where s.id = story_id and s.visibility = 'everyone' and s.expires_at > now()))$p$);
select pg_temp.sx_policy('sx_highlight_likes', 'sx_highlight_likes_update', $p$for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_highlight_likes', 'sx_highlight_likes_delete', $p$for delete to authenticated using (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_highlight_shares', 'sx_highlight_shares_insert', $p$for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.sx_stories s where s.id = story_id and s.visibility = 'everyone' and s.expires_at > now()))$p$);

-- Own-row tables.
select pg_temp.sx_policy('sx_preferences', 'sx_preferences_self', $p$for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_push_tokens', 'sx_push_tokens_own', $p$for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_memory_vault', 'sx_memory_vault_self', $p$for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('memories', 'memories_owner', $p$for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_plus_prefs', 'sx_plus_prefs_own', $p$for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_entitlements', 'sx_entitlements_read_own', $p$for select to authenticated using (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_blocks', 'sx_blocks_own_read', $p$for select to authenticated using (blocker_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_blocks', 'sx_blocks_own_insert', $p$for insert to authenticated with check (blocker_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_blocks', 'sx_blocks_own_delete', $p$for delete to authenticated using (blocker_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_hidden_suggestions', 'sx_hidden_suggestions_own_read', $p$for select to authenticated using ((select auth.uid()) = user_id)$p$);
select pg_temp.sx_policy('sx_hidden_suggestions', 'sx_hidden_suggestions_own_insert', $p$for insert to authenticated
  with check ((select auth.uid()) = user_id and other_id <> (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_avatar_outfits', 'sx_avatar_outfits_own_read', $p$for select to authenticated using (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_avatar_outfits', 'sx_avatar_outfits_own_insert', $p$for insert to authenticated with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_avatar_outfits', 'sx_avatar_outfits_own_update', $p$for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
select pg_temp.sx_policy('sx_location_allowed', 'sx_location_allowed_owner', $p$for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and app_private.sx_is_friend(friend_id))$p$);
-- sx_reports, sx_login_history, sx_staff_bans, sx_staff_warnings keep the policies of their staff migrations;
-- without them RLS denies every row (safe default).

-- ---------------------------------------------------------------- 4. map: own row + friends with ghost mode respected
select pg_temp.sx_policy('sx_locations', 'sx_locations_self', $p$for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$);
do $$
declare cond text;
begin
  if not pg_temp.sx_has_table('sx_locations') then
    raise notice 'sx policies: public.sx_locations does not exist, sx_locations_friends skipped';
    return;
  end if;
  cond := 'user_id <> (select auth.uid()) and sharing = true and updated_at > now() - interval ''24 hours'''
       || ' and app_private.sx_is_friend(user_id)';
  if pg_temp.sx_has_columns('sx_locations', array['share_audience', 'ghost_until', 'ghost_forever']) then
    cond := cond
       || ' and not ghost_forever and (ghost_until is null or ghost_until <= now())'
       || ' and (share_audience = ''all'' or (share_audience = ''selected'' and app_private.sx_location_allows(user_id)))';
  else
    raise notice 'sx policies: sx_locations has no ghost columns yet (20261013170000_map_sharing_ghost); only sharing + 24 h apply';
  end if;
  execute 'drop policy if exists sx_locations_friends on public.sx_locations';
  execute 'create policy sx_locations_friends on public.sx_locations for select to authenticated using (' || cond || ')';
end $$;

-- ---------------------------------------------------------------- 5. own profile row on demand
create or replace function public.sx_ensure_profile()
returns table (id uuid, username text, display_name text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_meta jsonb;
  v_hex text;
  v_base text;
  v_name text;
  v_display text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if to_regprocedure('app_private.sx_request_is_banned()') is not null then
    if (select app_private.sx_request_is_banned()) then raise exception 'account_blocked' using errcode = '42501'; end if;
  end if;
  select u.raw_user_meta_data into v_meta from auth.users u where u.id = v_uid;
  if not found then raise exception 'not_authenticated' using errcode = '42501'; end if;
  v_hex := left(replace(v_uid::text, '-', ''), 8);
  v_base := lower(coalesce(v_meta->>'username', ''));
  if v_base !~ '^[a-z0-9_]{3,24}$' then v_base := 'user_' || v_hex; end if;
  v_name := v_base;
  if exists (select 1 from public.profiles p where p.username = v_name and p.id <> v_uid) then
    v_name := left(v_base, 19) || '_' || left(v_hex, 4);
  end if;
  v_display := nullif(btrim(left(coalesce(v_meta->>'display_name', ''), 60)), '');
  insert into public.profiles (id, username, display_name)
    values (v_uid, v_name, coalesce(v_display, v_name))
    on conflict (id) do nothing;
  update public.profiles p set username = v_name where p.id = v_uid and coalesce(p.username, '') = '';
  return query select p.id, p.username::text, p.display_name::text from public.profiles p where p.id = v_uid;
end $$;
revoke all on function public.sx_ensure_profile() from public, anon;
grant execute on function public.sx_ensure_profile() to authenticated;

-- ---------------------------------------------------------------- 6. RPC execute grants + ban guard
do $$
declare f text;
begin
  foreach f in array array[
    'public.sx_accept_friend(uuid)', 'public.sx_open_thread(uuid[],text)', 'public.sx_claim_snap(uuid)',
    'app_private.sx_claim_snap_internal(uuid)', 'public.sx_set_retention(uuid,text,text)',
    'public.sx_suggest_friends(integer)', 'public.sx_hide_suggestion(uuid)', 'public.sx_highlight_feed(integer)',
    'public.sx_friend_avatar_outfits(uuid[])', 'public.sx_check_app_access()', 'public.sx_is_plus(uuid)',
    'app_private.sx_request_is_banned()', 'app_private.sx_account_active()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    else
      raise notice 'sx grants: function % does not exist, skipped', f;
    end if;
  end loop;
end $$;

do $$
declare t text;
begin
  if to_regprocedure('app_private.sx_request_is_banned()') is null then
    raise notice 'sx ban guard: app_private.sx_request_is_banned() missing, skipped';
    return;
  end if;
  foreach t in array array[
    'sx_friend_requests','sx_friends','sx_threads','sx_members','sx_messages','sx_receipts','sx_reactions','sx_stories',
    'sx_story_views','sx_story_reactions','sx_preferences','sx_push_tokens','sx_locations','sx_location_allowed',
    'sx_highlight_likes','sx_highlight_shares','sx_memory_vault','memories','sx_plus_prefs','sx_blocks',
    'sx_hidden_suggestions','sx_avatar_outfits','sx_reports'
  ] loop
    if pg_temp.sx_has_table(t) then
      execute format('drop policy if exists sx_active_ban_guard on public.%I', t);
      execute format('create policy sx_active_ban_guard on public.%I as restrictive for all to authenticated '
        || 'using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned())', t);
    end if;
  end loop;
end $$;

drop function pg_temp.sx_policy(text, text, text);
drop function pg_temp.sx_on_table(text, text);
drop function pg_temp.sx_has_columns(text, text[]);
drop function pg_temp.sx_has_table(text);

commit;

notify pgrst, 'reload schema';
