-- Group remove rights ("Verwijderen uit groep" / "Rechten geven: kan leden verwijderen").
-- NOT APPLIED to any project yet (source file only). Extends 20261021150000_group_chat_management.sql (also unapplied;
-- apply that one first) instead of adding a parallel table: the app's group membership table is public.sx_members,
-- exposed read-only under the requested name as the view public.group_members (group_id = thread_id).
-- Rules (same as lib/group-chat.ts canRemoveMember / canGrantRights and the demo client):
--   * exactly one role = 'admin' per group = sx_threads.created_by (kept in sync by trigger, also when the admin leaves);
--   * only the admin may set can_remove_members (sx_set_can_remove_members), never on itself;
--   * the admin or a member with can_remove_members may remove others (sx_remove_group_member);
--   * nobody can remove the admin, and nobody removes themselves with it (use sx_leave_group).
-- Clients never get UPDATE/DELETE on sx_members; triggers additionally refuse role/flag changes and admin-row deletes
-- from the API roles, so the SECURITY DEFINER RPCs are the only way in.

-- 1. Columns + backfill.
alter table public.sx_members add column if not exists role text not null default 'member';
alter table public.sx_members add column if not exists can_remove_members boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sx_members_role_check') then
    alter table public.sx_members add constraint sx_members_role_check check (role in ('admin', 'member'));
  end if;
end $$;
update public.sx_members m set role = 'admin', can_remove_members = false
  from public.sx_threads t where t.id = m.thread_id and t.created_by = m.user_id and t.is_group and m.role <> 'admin';
update public.sx_members m set role = 'member'
  from public.sx_threads t where t.id = m.thread_id and m.role = 'admin' and (t.created_by is distinct from m.user_id or not t.is_group);

-- Exactly one admin per group (at most one row; deferred so an admin hand-over can swap rows in one transaction).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sx_members_one_admin') then
    alter table public.sx_members add constraint sx_members_one_admin
      exclude using btree (thread_id with =) where (role = 'admin') deferrable initially deferred;
  end if;
end $$;

-- 2. Helpers.
create or replace function app_private.sx_is_group_admin(p_thread_id uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = p_user and m.role = 'admin')
$$;
revoke all on function app_private.sx_is_group_admin(uuid, uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.sx_is_group_admin(uuid, uuid) to authenticated; -- used by the RLS policies below

create or replace function app_private.sx_is_group_creator(p_thread_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sx_threads t where t.id = p_thread_id and t.created_by = p_user and t.is_group)
$$;
revoke all on function app_private.sx_is_group_creator(uuid, uuid) from public, anon, authenticated;

-- 3. Guards (defence in depth next to the missing UPDATE/DELETE grants).
-- SECURITY INVOKER on purpose: current_user must be the caller's role (definer RPCs run as the owner and pass).
create or replace function app_private.sx_members_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_api boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    new.role := case when app_private.sx_is_group_creator(new.thread_id, new.user_id) then 'admin' else 'member' end;
    if v_api or new.role = 'admin' then new.can_remove_members := false; end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if v_api and new.role is distinct from old.role then
      raise exception 'Only the group admin can change member rights';
    end if;
    if v_api and new.can_remove_members is distinct from old.can_remove_members
       and not app_private.sx_is_group_admin(old.thread_id, auth.uid()) then
      raise exception 'Only the group admin can change member rights';
    end if;
    return new;
  else
    if v_api and old.role = 'admin' then raise exception 'The group admin cannot be removed'; end if;
    return old;
  end if;
end $$;
revoke all on function app_private.sx_members_guard() from public, anon;
drop trigger if exists sx_members_guard_ins on public.sx_members;
create trigger sx_members_guard_ins before insert on public.sx_members for each row execute function app_private.sx_members_guard();
drop trigger if exists sx_members_guard_upd on public.sx_members;
create trigger sx_members_guard_upd before update on public.sx_members for each row execute function app_private.sx_members_guard();
drop trigger if exists sx_members_guard_del on public.sx_members;
create trigger sx_members_guard_del before delete on public.sx_members for each row execute function app_private.sx_members_guard();

-- Admin follows sx_threads.created_by (sx_leave_group hands it to the longest-standing member).
create or replace function app_private.sx_sync_group_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.sx_members set role = 'member' where thread_id = new.id and role = 'admin' and user_id is distinct from new.created_by;
  update public.sx_members set role = 'admin', can_remove_members = false
    where thread_id = new.id and user_id = new.created_by and new.is_group and role <> 'admin';
  return new;
end $$;
revoke all on function app_private.sx_sync_group_admin() from public, anon, authenticated;
drop trigger if exists sx_threads_sync_admin on public.sx_threads;
create trigger sx_threads_sync_admin after insert or update of created_by, is_group on public.sx_threads
  for each row execute function app_private.sx_sync_group_admin();
-- sx_open_thread inserts the thread before its members: the insert trigger above assigns the role per row.

-- 4. Privileges + RLS: read stays "members of the thread" (sx_members_read); no direct writes for API roles.
revoke insert, update, delete on public.sx_members from anon, authenticated;
alter table public.sx_members enable row level security;
drop policy if exists sx_members_update_admin_only on public.sx_members;
create policy sx_members_update_admin_only on public.sx_members as restrictive for update to authenticated
  using (app_private.sx_is_group_admin(thread_id)) with check (app_private.sx_is_group_admin(thread_id));
drop policy if exists sx_members_delete_never_admin on public.sx_members;
create policy sx_members_delete_never_admin on public.sx_members as restrictive for delete to authenticated
  using (role <> 'admin');

create or replace view public.group_members with (security_invoker = true) as
  select thread_id as group_id, user_id, role, can_remove_members, joined_at from public.sx_members;
revoke all on public.group_members from public, anon;
grant select on public.group_members to authenticated;

-- 5. RPCs.
create or replace function public.sx_set_can_remove_members(p_thread_id uuid, p_user_id uuid, p_value boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads; v_old boolean; v_on boolean := coalesce(p_value, false);
begin
  t := app_private.sx_lock_group(p_thread_id);
  if not app_private.sx_is_group_admin(p_thread_id, uid) then raise exception 'Only the group admin can change member rights'; end if;
  if p_user_id is null or p_user_id = uid then raise exception 'Only the group admin can change member rights'; end if;
  select m.can_remove_members into v_old from public.sx_members m where m.thread_id = p_thread_id and m.user_id = p_user_id;
  if not found then raise exception 'Member not found'; end if;
  if v_old is distinct from v_on then
    update public.sx_members set can_remove_members = v_on where thread_id = p_thread_id and user_id = p_user_id;
    perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft ' || app_private.sx_display_name(p_user_id)
      || case when v_on then ' rechten gegeven om leden te verwijderen' else ' de rechten om leden te verwijderen ontnomen' end);
  end if;
  return v_on;
end $$;
revoke all on function public.sx_set_can_remove_members(uuid, uuid, boolean) from public, anon;
grant execute on function public.sx_set_can_remove_members(uuid, uuid, boolean) to authenticated;

-- Replaces the creator-only version from 20261021150000 (same signature, same Dutch line).
create or replace function public.sx_remove_group_member(p_thread_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads; v_role text;
begin
  t := app_private.sx_lock_group(p_thread_id);
  if p_user_id is null or p_user_id = uid then raise exception 'Use leave to remove yourself'; end if;
  select m.role into v_role from public.sx_members m where m.thread_id = p_thread_id and m.user_id = p_user_id;
  if not found then raise exception 'Member not found'; end if;
  if v_role = 'admin' or p_user_id = t.created_by then raise exception 'The group admin cannot be removed'; end if;
  if not exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = uid
                   and (m.role = 'admin' or m.can_remove_members)) then
    raise exception 'Not allowed to remove members';
  end if;
  update public.sx_threads set is_group = true where id = p_thread_id and not is_group;
  perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft '
    || app_private.sx_display_name(p_user_id) || ' uit de groep verwijderd');
  delete from public.sx_members where thread_id = p_thread_id and user_id = p_user_id;
end $$;
revoke all on function public.sx_remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.sx_remove_group_member(uuid, uuid) to authenticated;

-- 6. Realtime: removals/rights changes reach every open member list. Full replica identity so DELETE events carry
-- thread_id (clients refetch membership; RLS still limits who receives which rows).
alter table public.sx_members replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sx_members') then
    alter publication supabase_realtime add table public.sx_members;
  end if;
end $$;
