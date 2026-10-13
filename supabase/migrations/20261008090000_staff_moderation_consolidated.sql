-- =====================================================================================================
-- NOT APPLIED YET. Written 2026-10-08 (phase 1b); has NOT been run against the live Supabase project.
-- Review, then apply deliberately (e.g. `supabase db push` / SQL editor) after checking the prerequisites
-- below. Only tested on a throwaway local Postgres 17 with stubbed Supabase/legacy objects.
-- =====================================================================================================
-- Staff moderation, consolidated into one idempotent migration.
--
-- Replaces the loose, order-dependent files (now removed; see git history at 61fdd39):
--   supabase/staff-moderation.sql, staff-moderation-backfill.sql, staff-security-guards.sql,
--   staff-rpc-privileges.sql
-- and keeps their combined end state (tables, IP/device/user bans, UUID device ids, 180-day login-history
-- check for IP/device bans, legacy ban/suspension import, restrictive ban guards, media policy), with
-- one security fix:
--   staff-rpc-privileges.sql replaced the ban-checking public wrappers by SECURITY DEFINER wrappers
--   without any ban check, so a banned staff member with a still-valid JWT could keep listing/reading
--   chats, deleting messages and creating/revoking bans. Every staff RPC now calls
--   app_private.sx_require_staff() INSIDE the function: signed in + auth user exists + no pending
--   deletion + no active user/IP/device ban (app_private.sx_account_active) + the required staff role.
--
-- Prerequisites (exist in the live project, not all defined in this repo): public.profiles, public.roles,
-- public.user_roles, public.audit_logs, public.staff_role, public.report_status, the sx_* tables from
-- supabase/schema.sql, app_private.sx_deletion_pending (20260926081230_account_deletion) and
-- app_private.sx_blocked_with (20260926075332_user_blocking). public.bans / public.suspensions are
-- optional (legacy import is skipped when they are missing).
-- Safe to run more than once: create ... if not exists, create or replace, drop ... if exists + create.
-- =====================================================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.sx_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  ip_address inet,
  device_id uuid not null,
  device_label text,
  user_agent text
);
create index if not exists sx_login_history_user_time on public.sx_login_history(user_id, logged_at desc);
create index if not exists sx_login_history_ip on public.sx_login_history(ip_address);
create index if not exists sx_login_history_device on public.sx_login_history(device_id);

create table if not exists public.sx_staff_bans (
  id uuid primary key default gen_random_uuid(),
  ban_type text not null check (ban_type in ('user','ip','device')),
  target_user_id uuid references auth.users(id) on delete cascade,
  target_ip inet,
  target_device_id uuid,
  reason text not null,
  issued_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoke_reason text,
  check (
    (ban_type='user' and target_user_id is not null and target_ip is null and target_device_id is null) or
    (ban_type='ip' and target_user_id is null and target_ip is not null and target_device_id is null) or
    (ban_type='device' and target_user_id is null and target_ip is null and target_device_id is not null)
  ),
  check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null)),
  check (ends_at is null or ends_at > created_at)
);
-- Legacy import columns + reason rule (from staff-moderation-backfill.sql).
alter table public.sx_staff_bans add column if not exists legacy_source text;
alter table public.sx_staff_bans add column if not exists legacy_id uuid;
alter table public.sx_staff_bans alter column issued_by drop not null;
alter table public.sx_staff_bans drop constraint if exists sx_staff_bans_reason_check;
alter table public.sx_staff_bans add constraint sx_staff_bans_reason_check
  check (char_length(trim(reason)) between 1 and 1000 and (legacy_source is not null or char_length(trim(reason))>=8));
alter table public.sx_staff_bans drop constraint if exists sx_staff_bans_legacy_source_check;
alter table public.sx_staff_bans add constraint sx_staff_bans_legacy_source_check
  check ((legacy_source is null and legacy_id is null) or (legacy_source in ('bans','suspensions') and legacy_id is not null));
create unique index if not exists sx_staff_bans_legacy_unique on public.sx_staff_bans(legacy_source,legacy_id) where legacy_id is not null;
create index if not exists sx_staff_bans_active_user on public.sx_staff_bans(target_user_id) where revoked_at is null;
create index if not exists sx_staff_bans_active_ip on public.sx_staff_bans(target_ip) where revoked_at is null;
create index if not exists sx_staff_bans_active_device on public.sx_staff_bans(target_device_id) where revoked_at is null;

-- Columns used by the staff message delete and media policy (also created by media-cleanup.sql).
alter table public.sx_messages add column if not exists media_deleted_at timestamptz;
alter table public.sx_stories add column if not exists media_deleted_at timestamptz;

alter table public.sx_login_history enable row level security;
alter table public.sx_staff_bans enable row level security;
revoke all on public.sx_login_history, public.sx_staff_bans from public, anon, authenticated;
grant select on public.sx_login_history, public.sx_staff_bans to authenticated;
grant insert on public.sx_login_history to service_role;

-- ---------------------------------------------------------------- legacy import (idempotent)
do $$
begin
  if to_regclass('public.bans') is not null then
    insert into public.sx_staff_bans(ban_type,target_user_id,reason,issued_by,created_at,ends_at,legacy_source,legacy_id)
    select 'user',b.user_id,coalesce(nullif(trim(b.reason),''),'Legacy ban (reason not provided)'),b.issued_by,b.created_at,null,'bans',b.id
    from public.bans b
    where not exists(select 1 from public.sx_staff_bans n where n.legacy_source='bans' and n.legacy_id=b.id);
  end if;
  if to_regclass('public.suspensions') is not null then
    insert into public.sx_staff_bans(ban_type,target_user_id,reason,issued_by,created_at,ends_at,legacy_source,legacy_id)
    select 'user',s.user_id,coalesce(nullif(trim(s.reason),''),'Legacy suspension (reason not provided)'),s.issued_by,s.starts_at,s.ends_at,'suspensions',s.id
    from public.suspensions s
    where s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())
      and not exists(select 1 from public.sx_staff_bans n where n.legacy_source='suspensions' and n.legacy_id=s.id);
  end if;
end $$;

-- ---------------------------------------------------------------- ban + account helpers (unchanged)
-- Single app-data enforcement check for user, IP, and install (device UUID) bans.
create or replace function app_private.sx_request_is_banned()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_headers jsonb := '{}'::jsonb;
  v_ip inet;
  v_device uuid;
  v_ip_text text;
  v_device_text text;
begin
  if v_uid is null then return true; end if;
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip_text := coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-real-ip', split_part(coalesce(v_headers->>'x-forwarded-for',''), ',', 1));
  v_ip_text := nullif(trim(v_ip_text), '');
  if v_ip_text is not null then
    begin v_ip := v_ip_text::inet; exception when others then v_ip := null; end;
  end if;
  -- Header name kept for compatibility with lib/supabase.ts and existing installs.
  v_device_text := nullif(v_headers->>'x-snaplion-device-id','');
  if v_device_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_device := v_device_text::uuid;
  end if;
  return exists (
    select 1 from public.sx_staff_bans b
    where b.revoked_at is null and (b.ends_at is null or b.ends_at > now())
      and ((b.ban_type='user' and b.target_user_id=v_uid)
        or (b.ban_type='ip' and v_ip is not null and b.target_ip=v_ip)
        or (b.ban_type='device' and v_device is not null and b.target_device_id=v_device))
  );
end;
$$;
revoke all on function app_private.sx_request_is_banned() from public, anon;
grant execute on function app_private.sx_request_is_banned() to authenticated;

create or replace function app_private.sx_account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists (select 1 from auth.users u where u.id=(select auth.uid()))
    and not exists (select 1 from app_private.sx_deletion_pending d where d.user_id=(select auth.uid()))
    and not app_private.sx_request_is_banned();
$$;
create or replace function app_private.sx_is_member(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.sx_account_active()
    and exists(select 1 from public.sx_members m where m.thread_id=t and m.user_id=(select auth.uid()));
$$;

-- ---------------------------------------------------------------- single staff helper (NEW)
-- Role check on the repo-visible tables (does not depend on the live-only public.has_staff_role).
-- Only real staff roles count, so passing 'USER' can never grant staff access.
create or replace function app_private.sx_staff_has_role(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=(select auth.uid())
      and r.name::text = any(p_roles)
      and r.name::text in ('MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'));
$$;
revoke all on function app_private.sx_staff_has_role(text[]) from public, anon;
grant execute on function app_private.sx_staff_has_role(text[]) to authenticated;

-- Raises 42501 unless the caller is an active (exists, not being deleted), non-banned (user/IP/device)
-- staff member with one of p_roles. Returns the caller id. Called inside every staff RPC.
create or replace function app_private.sx_require_staff(
  p_roles text[] default array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'])
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not app_private.sx_account_active() or not app_private.sx_staff_has_role(p_roles) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  return v_uid;
end;
$$;
revoke all on function app_private.sx_require_staff(text[]) from public, anon, authenticated;

-- Report linkage: a staff action taken from a report (public.sx_staff_report_action) sets the
-- transaction-local setting snapshotx.report_id; audit rows written in that transaction carry it.
create or replace function app_private.sx_audit_meta(p_meta jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v text := nullif(current_setting('snapshotx.report_id', true), '');
begin
  if v is not null and v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('report_id', v);
  end if;
  return coalesce(p_meta,'{}'::jsonb);
end;
$$;
revoke all on function app_private.sx_audit_meta(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- policies
drop policy if exists sx_login_history_staff_read on public.sx_login_history;
create policy sx_login_history_staff_read on public.sx_login_history for select to authenticated
using (app_private.sx_staff_has_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']) and not app_private.sx_request_is_banned());
drop policy if exists sx_staff_bans_staff_read on public.sx_staff_bans;
create policy sx_staff_bans_staff_read on public.sx_staff_bans for select to authenticated
using (app_private.sx_staff_has_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']) and not app_private.sx_request_is_banned());
drop policy if exists sx_login_history_not_banned on public.sx_login_history;
create policy sx_login_history_not_banned on public.sx_login_history as restrictive for select to authenticated
using (not app_private.sx_request_is_banned());
drop policy if exists sx_staff_bans_not_banned on public.sx_staff_bans;
create policy sx_staff_bans_not_banned on public.sx_staff_bans as restrictive for select to authenticated
using (not app_private.sx_request_is_banned());

-- Moderators see moderation actions in the audit log (global audit stays admin-only).
drop policy if exists sx_audit_logs_moderation_read on public.audit_logs;
create policy sx_audit_logs_moderation_read on public.audit_logs for select to authenticated
using (
  not app_private.sx_request_is_banned()
  and app_private.sx_staff_has_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'])
  and (action like 'sx_staff_%' or action='sx_review_report')
);

-- Defense in depth: banned accounts cannot use any app-data table through the Data API.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','friendships','friend_requests','blocks','conversations','conversation_members','messages','message_media','message_receipts',
    'stories','story_views','private_stories','private_story_members','memories','notifications','calls','call_members','activity_events',
    'reports','moderation_cases','warnings','suspensions','bans','appeals',
    'sx_friend_requests','sx_friends','sx_threads','sx_members','sx_messages','sx_receipts','sx_stories','sx_story_views','sx_story_reactions',
    'sx_preferences','sx_push_tokens','sx_push_deliveries','sx_push_recipient_deliveries','sx_locations','sx_daily_activity','sx_reports','sx_blocks',
    'sx_avatar_outfits'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists sx_active_ban_guard on public.%I', t);
      execute format('create policy sx_active_ban_guard on public.%I as restrictive for all to authenticated using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned())', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- staff functions (private)
create or replace function app_private.sx_staff_list_chats()
returns table(thread_id uuid, title text, created_at timestamptz, member_count bigint, last_message_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.sx_require_staff();
  return query
    select t.id, t.title, t.created_at,
      (select count(*) from public.sx_members m where m.thread_id=t.id),
      (select max(msg.created_at) from public.sx_messages msg where msg.thread_id=t.id)
    from public.sx_threads t
    order by coalesce((select max(msg.created_at) from public.sx_messages msg where msg.thread_id=t.id), t.created_at) desc
    limit 200;
end;
$$;

create or replace function app_private.sx_staff_read_chat(p_thread_id uuid, p_reason text)
returns table(message_id uuid, sender_id uuid, kind text, body text, created_at timestamptz, is_deleted boolean)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff();
begin
  if char_length(trim(coalesce(p_reason,''))) < 10 or char_length(p_reason)>1000 then
    raise exception 'A reason of at least 10 characters is required';
  end if;
  if not exists(select 1 from public.sx_threads t where t.id=p_thread_id) then raise exception 'chat not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_chat_open','sx_thread',p_thread_id,
    app_private.sx_audit_meta(jsonb_build_object('reason',trim(p_reason),'old_status','not_opened_by_staff','new_status','opened_by_staff')));
  return query
    select m.id,m.sender_id,m.kind,
      case when m.media_deleted_at is not null then null else m.body end,
      m.created_at,(m.media_deleted_at is not null)
    from public.sx_messages m
    where m.thread_id=p_thread_id and (m.expires_at is null or m.expires_at>now())
    order by m.created_at asc
    limit 500;
end;
$$;

create or replace function app_private.sx_staff_delete_message(p_message_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(); v_message public.sx_messages%rowtype;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'A deletion reason of at least 8 characters is required'; end if;
  select * into v_message from public.sx_messages where id=p_message_id for update;
  if not found then raise exception 'message not found'; end if;
  if v_message.media_deleted_at is not null then raise exception 'message already removed'; end if;
  update public.sx_messages set body=null, media_deleted_at=now() where id=p_message_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_message_delete','sx_message',p_message_id,
    app_private.sx_audit_meta(jsonb_build_object('thread_id',v_message.thread_id,'sender_id',v_message.sender_id,'reason',trim(p_reason),'old_status','visible','new_status','removed')));
end;
$$;

create or replace function app_private.sx_staff_create_ban(
  p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.sx_require_staff();
  v_id uuid;
  v_target jsonb;
begin
  if p_type not in ('user','ip','device') or char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'invalid ban request'; end if;
  if p_duration_minutes is not null and (p_duration_minutes<1 or p_duration_minutes>525600) then raise exception 'duration must be between 1 minute and 365 days'; end if;
  if (p_type='user' and (p_user_id is null or p_ip is not null or p_device_id is not null))
   or (p_type='ip' and (p_user_id is not null or p_ip is null or p_device_id is not null))
   or (p_type='device' and (p_user_id is not null or p_ip is not null or p_device_id is null)) then raise exception 'target does not match ban type'; end if;
  if p_type='user' then
    if p_user_id=v_uid or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'invalid target user'; end if;
    if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id and r.name in ('MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'))
      and not app_private.sx_staff_has_role(array['OWNER']) then raise exception 'only owner may ban staff'; end if;
    if exists(select 1 from public.sx_staff_bans b where b.revoked_at is null and (b.ends_at is null or b.ends_at>now()) and b.ban_type='user' and b.target_user_id=p_user_id) then raise exception 'user already has an active ban'; end if;
    v_target:=jsonb_build_object('user_id',p_user_id);
  elsif p_type='ip' then
    if not exists(select 1 from public.sx_login_history h where h.ip_address=p_ip and h.logged_at>now()-interval '180 days') then raise exception 'IP not found in recent login history'; end if;
    if exists(select 1 from public.sx_staff_bans b where b.revoked_at is null and (b.ends_at is null or b.ends_at>now()) and b.ban_type='ip' and b.target_ip=p_ip) then raise exception 'IP already has an active ban'; end if;
    v_target:=jsonb_build_object('ip',p_ip::text);
  else
    if not exists(select 1 from public.sx_login_history h where h.device_id=p_device_id and h.logged_at>now()-interval '180 days') then raise exception 'device not found in recent login history'; end if;
    if exists(select 1 from public.sx_staff_bans b where b.revoked_at is null and (b.ends_at is null or b.ends_at>now()) and b.ban_type='device' and b.target_device_id=p_device_id) then raise exception 'device already has an active ban'; end if;
    v_target:=jsonb_build_object('device_id',p_device_id);
  end if;
  insert into public.sx_staff_bans(ban_type,target_user_id,target_ip,target_device_id,reason,issued_by,ends_at)
  values(p_type,p_user_id,p_ip,p_device_id,trim(p_reason),v_uid,
    case when p_duration_minutes is null then null else now()+make_interval(mins=>p_duration_minutes) end)
  returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_ban_create','sx_staff_ban',v_id,
    app_private.sx_audit_meta(jsonb_build_object('type',p_type,'target',v_target,'reason',trim(p_reason),'duration_minutes',p_duration_minutes,'old_status','not_banned','new_status','active')));
  return v_id;
end;
$$;

create or replace function app_private.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(); v_ban public.sx_staff_bans%rowtype; v_target jsonb;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'An unban reason of at least 8 characters is required'; end if;
  select * into v_ban from public.sx_staff_bans where id=p_ban_id and revoked_at is null for update;
  if not found or (v_ban.ends_at is not null and v_ban.ends_at<=now()) then raise exception 'active ban not found'; end if;
  update public.sx_staff_bans set revoked_at=now(),revoked_by=v_uid,revoke_reason=trim(p_reason) where id=p_ban_id;
  v_target:=case v_ban.ban_type when 'user' then jsonb_build_object('user_id',v_ban.target_user_id) when 'ip' then jsonb_build_object('ip',v_ban.target_ip::text) else jsonb_build_object('device_id',v_ban.target_device_id) end;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_ban_revoke','sx_staff_ban',p_ban_id,
    app_private.sx_audit_meta(jsonb_build_object('type',v_ban.ban_type,'target',v_target,'reason',trim(p_reason),'ban_reason',v_ban.reason,'old_status','active','new_status','revoked')));
end;
$$;

-- Private implementations are only reachable through the public wrappers below.
revoke all on function app_private.sx_staff_list_chats() from public, anon, authenticated;
revoke all on function app_private.sx_staff_read_chat(uuid,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_delete_message(uuid,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_revoke_ban(uuid,text) from public, anon, authenticated;

-- ---------------------------------------------------------------- public RPC wrappers
-- SECURITY DEFINER so they can reach app_private; authorization happens inside the private functions.
create or replace function public.sx_staff_list_chats()
returns table(thread_id uuid,title text,created_at timestamptz,member_count bigint,last_message_at timestamptz)
language sql security definer set search_path = '' as $$ select * from app_private.sx_staff_list_chats() $$;
create or replace function public.sx_staff_read_chat(p_thread_id uuid,p_reason text)
returns table(message_id uuid,sender_id uuid,kind text,body text,created_at timestamptz,is_deleted boolean)
language sql security definer set search_path = '' as $$ select * from app_private.sx_staff_read_chat(p_thread_id,p_reason) $$;
create or replace function public.sx_staff_delete_message(p_message_id uuid,p_reason text)
returns void language sql security definer set search_path = '' as $$ select app_private.sx_staff_delete_message(p_message_id,p_reason) $$;
create or replace function public.sx_staff_create_ban(p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text)
returns uuid language sql security definer set search_path = '' as $$ select app_private.sx_staff_create_ban(p_type,p_user_id,p_ip,p_device_id,p_duration_minutes,p_reason) $$;
create or replace function public.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language sql security definer set search_path = '' as $$ select app_private.sx_staff_revoke_ban(p_ban_id,p_reason) $$;
revoke all on function public.sx_staff_list_chats() from public, anon;
revoke all on function public.sx_staff_read_chat(uuid,text) from public, anon;
revoke all on function public.sx_staff_delete_message(uuid,text) from public, anon;
revoke all on function public.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) from public, anon;
revoke all on function public.sx_staff_revoke_ban(uuid,text) from public, anon;
grant execute on function public.sx_staff_list_chats() to authenticated;
grant execute on function public.sx_staff_read_chat(uuid,text) to authenticated;
grant execute on function public.sx_staff_delete_message(uuid,text) to authenticated;
grant execute on function public.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) to authenticated;
grant execute on function public.sx_staff_revoke_ban(uuid,text) to authenticated;

-- Sign-in gate used by hooks/useSession.tsx (user/IP/device ban check for the current request).
create or replace function public.sx_check_app_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and not app_private.sx_request_is_banned();
$$;
revoke all on function public.sx_check_app_access() from public, anon;
grant execute on function public.sx_check_app_access() to authenticated;

-- Report review (same contract as 20260925184916 + staff-security-guards.sql), with the shared check.
create or replace function public.sx_review_report(p_report_id uuid,p_status public.report_status,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff();
begin
  if p_status not in ('reviewing','resolved','dismissed') or char_length(coalesce(p_note,''))>1000 then raise exception 'invalid review'; end if;
  update public.sx_reports set status=p_status,reviewer_id=v_uid,review_note=p_note,reviewed_at=now() where id=p_report_id;
  if not found then raise exception 'report not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_review_report','sx_report',p_report_id,jsonb_build_object('status',p_status,'note',p_note));
end;
$$;
revoke all on function public.sx_review_report(uuid,public.report_status,text) from public, anon;
grant execute on function public.sx_review_report(uuid,public.report_status,text) to authenticated;

-- Role management as in staff-security-guards.sql (superseded by 20261008090100_staff_panel_1b.sql,
-- which adds revoke-what-you-can-grant and the last-owner guard).
create or replace function public.sx_manage_staff_role(p_user_id uuid,p_role public.staff_role,p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(); v_role_id uuid;
begin
  if p_user_id=v_uid
    or not (app_private.sx_staff_has_role(array['OWNER'])
      or (p_role='MODERATOR' and app_private.sx_staff_has_role(array['ADMIN'])))
    or p_role not in ('MODERATOR','SENIOR MODERATOR','ADMIN') then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select id into v_role_id from public.roles where name=p_role;
  if v_role_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'target not found'; end if;
  if p_grant then
    insert into public.user_roles(user_id,role_id,granted_by) values(p_user_id,v_role_id,v_uid)
    on conflict(user_id,role_id) do nothing;
  else
    delete from public.user_roles where user_id=p_user_id and role_id=v_role_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_manage_staff_role','user',p_user_id,jsonb_build_object('role',p_role,'grant',p_grant));
end;
$$;
revoke all on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) from public, anon;
grant execute on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) to authenticated;

-- ---------------------------------------------------------------- storage read policy (end state of the loose files)
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
        and m.expires_at>now()
        and (not m.view_once or exists (
          select 1 from public.sx_receipts r where r.message_id=m.id and r.user_id=(select auth.uid())
            and r.opened_at>now()-interval '90 seconds'
        ))
    )
    or exists (
      select 1 from public.sx_stories s where s.media_path=name
        and not app_private.sx_blocked_with(s.owner_id)
        and (s.owner_id=(select auth.uid()) or (s.expires_at>now() and
          (s.visibility='everyone' or exists(select 1 from public.sx_friends f where f.user_id=(select auth.uid()) and f.friend_id=s.owner_id))))
    )
  )
);
