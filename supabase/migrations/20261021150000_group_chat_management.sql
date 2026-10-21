-- Group chat management ("Groepsinfo"): rename, add members, remove a member (creator only), leave.
-- NOT APPLIED to any project yet (source file only). Requires 20261013150000_chat_step4.sql (kind = 'system'
-- messages) and 20261019120000_sx_data_api_grants_rls.sql (app_private.sx_is_member).
-- Every change writes a Dutch system line in the chat, built server-side from profiles.display_name so a
-- client cannot spoof it. Same texts as lib/group-chat.ts (groupRenameText / groupAddText / ...).
-- Rules: max 20 members incl. the creator; only unblocked friends of the caller can be added; any member may
-- rename and add; only sx_threads.created_by may remove others; when the creator leaves, the longest-standing
-- member becomes creator; the last member leaving deletes the thread.

-- 1. Explicit group flag, so a group that shrinks to 2 members never turns into (or gets reused as) a 1-on-1.
alter table public.sx_threads add column if not exists is_group boolean not null default false;
update public.sx_threads t set is_group = true
  where not t.is_group
    and (t.title is not null or (select count(*) from public.sx_members m where m.thread_id = t.id) > 2);

-- sx_open_thread: same as 20260926075332_user_blocking.sql, plus is_group on insert and 1-on-1 reuse skips groups.
create or replace function public.sx_open_thread(participants uuid[], group_title text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid := auth.uid(); target uuid; peers uuid[];
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select array_agg(distinct p) into peers from unnest(participants) p where p <> uid;
  if peers is null or cardinality(peers)>20 then raise exception 'Choose 1 to 20 friends'; end if;
  foreach target in array peers loop
    if not exists(select 1 from public.sx_friends where user_id=uid and friend_id=target)
       or exists(select 1 from public.sx_blocks b
         where (b.blocker_id=uid and b.blocked_id=target)
            or (b.blocker_id=target and b.blocked_id=uid)) then
      raise exception 'Only unblocked friends can be added';
    end if;
  end loop;
  if cardinality(peers)=1 and group_title is null then
    select t.id into tid from public.sx_threads t
    where t.title is null and not t.is_group and
      (select count(*) from public.sx_members m where m.thread_id=t.id)=2 and
      exists(select 1 from public.sx_members m where m.thread_id=t.id and m.user_id=uid) and
      exists(select 1 from public.sx_members m where m.thread_id=t.id and m.user_id=peers[1])
    order by t.created_at limit 1;
    if tid is not null then return tid; end if;
  end if;
  insert into public.sx_threads(title,created_by,is_group)
    values (left(group_title,80),uid,cardinality(peers)>1 or group_title is not null) returning id into tid;
  insert into public.sx_members(thread_id,user_id) select tid,p from unnest(array_append(peers,uid)) p;
  return tid;
end $$;
revoke all on function public.sx_open_thread(uuid[],text) from public, anon;
grant execute on function public.sx_open_thread(uuid[],text) to authenticated;

-- 2. Helpers (not exposed through the Data API).
create or replace function app_private.sx_display_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Iemand')
  from (select 1) one left join public.profiles p on p.id = p_user
$$;
revoke all on function app_private.sx_display_name(uuid) from public, anon, authenticated;

-- Locks the thread row (serialises concurrent member changes) and checks: signed in, member, group thread.
create or replace function app_private.sx_lock_group(p_thread_id uuid) returns public.sx_threads
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into t from public.sx_threads where id = p_thread_id for update;
  if not found or not exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = uid) then
    raise exception 'Not a member of this group';
  end if;
  if not (t.is_group or t.title is not null or (select count(*) from public.sx_members m where m.thread_id = p_thread_id) > 2) then
    raise exception 'Not a group chat';
  end if;
  return t;
end $$;
revoke all on function app_private.sx_lock_group(uuid) from public, anon, authenticated;

create or replace function app_private.sx_group_line(p_thread_id uuid, p_text text) returns void
language sql security definer set search_path = '' as $$
  insert into public.sx_messages(thread_id, sender_id, kind, body, media_path, expires_at)
  values (p_thread_id, auth.uid(), 'system', left(p_text, 200), null, null)
$$;
revoke all on function app_private.sx_group_line(uuid, text) from public, anon, authenticated;

-- 3. Rename (any member). Returns the stored name.
create or replace function public.sx_rename_group(p_thread_id uuid, p_title text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads; v_title text;
begin
  t := app_private.sx_lock_group(p_thread_id);
  v_title := btrim(left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 80));
  if v_title = '' then raise exception 'Invalid group name'; end if;
  if t.title is distinct from v_title then
    update public.sx_threads set title = v_title, is_group = true where id = p_thread_id;
    perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft de groep hernoemd naar ' || v_title);
  end if;
  return v_title;
end $$;
revoke all on function public.sx_rename_group(uuid, text) from public, anon;
grant execute on function public.sx_rename_group(uuid, text) to authenticated;

-- 4. Add friends (any member). Skips people who are already in. Returns how many were added.
create or replace function public.sx_add_group_members(p_thread_id uuid, p_user_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads; v_new uuid[]; v_count int; target uuid; v_names text[];
begin
  t := app_private.sx_lock_group(p_thread_id);
  select coalesce(array_agg(distinct x), '{}') into v_new from unnest(coalesce(p_user_ids, '{}')) x
    where x is not null and x <> uid
      and not exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = x);
  if cardinality(v_new) = 0 then return 0; end if;
  select count(*) into v_count from public.sx_members m where m.thread_id = p_thread_id;
  if v_count + cardinality(v_new) > 20 then raise exception 'Group is full (max 20)'; end if;
  foreach target in array v_new loop
    if not exists (select 1 from public.sx_friends f where f.user_id = uid and f.friend_id = target)
       or exists (select 1 from public.sx_blocks b
         where (b.blocker_id = uid and b.blocked_id = target) or (b.blocker_id = target and b.blocked_id = uid)) then
      raise exception 'Only unblocked friends can be added';
    end if;
  end loop;
  insert into public.sx_members(thread_id, user_id) select p_thread_id, x from unnest(v_new) x on conflict do nothing;
  update public.sx_threads set is_group = true where id = p_thread_id and not is_group;
  select array_agg(app_private.sx_display_name(x) order by app_private.sx_display_name(x)) into v_names from unnest(v_new) x;
  perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft '
    || case when cardinality(v_names) = 1 then v_names[1]
            else array_to_string(v_names[1:cardinality(v_names) - 1], ', ') || ' en ' || v_names[cardinality(v_names)] end
    || ' toegevoegd');
  return cardinality(v_new);
end $$;
revoke all on function public.sx_add_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.sx_add_group_members(uuid, uuid[]) to authenticated;

-- 5. Remove a member (group creator only, never yourself: use sx_leave_group).
create or replace function public.sx_remove_group_member(p_thread_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads;
begin
  t := app_private.sx_lock_group(p_thread_id);
  if t.created_by is distinct from uid then raise exception 'Only the group creator can remove members'; end if;
  if p_user_id = uid then raise exception 'Use leave to remove yourself'; end if;
  if not exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = p_user_id) then
    raise exception 'Member not found';
  end if;
  update public.sx_threads set is_group = true where id = p_thread_id and not is_group;
  perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft '
    || app_private.sx_display_name(p_user_id) || ' uit de groep verwijderd');
  delete from public.sx_members where thread_id = p_thread_id and user_id = p_user_id;
end $$;
revoke all on function public.sx_remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.sx_remove_group_member(uuid, uuid) to authenticated;

-- 6. Leave (any member). Line first (while still a member), then drop the membership.
create or replace function public.sx_leave_group(p_thread_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.sx_threads; v_next uuid;
begin
  t := app_private.sx_lock_group(p_thread_id);
  update public.sx_threads set is_group = true where id = p_thread_id and not is_group;
  perform app_private.sx_group_line(p_thread_id, app_private.sx_display_name(uid) || ' heeft de groep verlaten');
  delete from public.sx_members where thread_id = p_thread_id and user_id = uid;
  select m.user_id into v_next from public.sx_members m where m.thread_id = p_thread_id order by m.joined_at, m.user_id limit 1;
  if v_next is null then
    delete from public.sx_threads where id = p_thread_id;
  elsif t.created_by = uid then
    update public.sx_threads set created_by = v_next where id = p_thread_id;
  end if;
end $$;
revoke all on function public.sx_leave_group(uuid) from public, anon;
grant execute on function public.sx_leave_group(uuid) to authenticated;
