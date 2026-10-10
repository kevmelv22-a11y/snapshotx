-- SNAPLION staff moderation and audit foundation. Additive only.
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
  reason text not null check (char_length(trim(reason)) between 8 and 1000),
  issued_by uuid not null references auth.users(id),
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
create index if not exists sx_staff_bans_active_user on public.sx_staff_bans(target_user_id) where revoked_at is null;
create index if not exists sx_staff_bans_active_ip on public.sx_staff_bans(target_ip) where revoked_at is null;
create index if not exists sx_staff_bans_active_device on public.sx_staff_bans(target_device_id) where revoked_at is null;
alter table public.sx_login_history enable row level security;
alter table public.sx_staff_bans enable row level security;
revoke all on public.sx_login_history, public.sx_staff_bans from public, anon, authenticated;
grant select on public.sx_login_history, public.sx_staff_bans to authenticated;
grant insert on public.sx_login_history to service_role;
drop policy if exists sx_login_history_staff_read on public.sx_login_history;
create policy sx_login_history_staff_read on public.sx_login_history for select to authenticated
using (public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]));
drop policy if exists sx_staff_bans_staff_read on public.sx_staff_bans;
create policy sx_staff_bans_staff_read on public.sx_staff_bans for select to authenticated
using (public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]));

-- This private helper is the single app-data enforcement check for user, IP, and install bans.
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
  -- Match record-login-history: only use the proxy headers accepted there.
  v_ip_text := coalesce(nullif(trim(v_headers->>'cf-connecting-ip'), ''), nullif(trim(v_headers->>'x-real-ip'), ''));
  if v_ip_text is not null then
    begin v_ip := v_ip_text::inet; exception when others then v_ip := null; end;
  end if;
  v_device_text := nullif(trim(v_headers->>'x-snaplion-device-id'),'');
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

-- Existing shared membership checks are used by the chat, messages, and media policies.
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

-- Keep global audit access admin-only, while allowing moderators to see moderation actions.
drop policy if exists sx_audit_logs_moderation_read on public.audit_logs;
create policy sx_audit_logs_moderation_read on public.audit_logs for select to authenticated
using (
  public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])
  and (action like 'sx_staff_%' or action='sx_review_report')
);

create or replace function app_private.sx_staff_list_chats()
returns table(thread_id uuid, title text, created_at timestamptz, member_count bigint, last_message_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then
    raise exception 'not authorized' using errcode='42501';
  end if;
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
begin
  if (select auth.uid()) is null or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if char_length(trim(coalesce(p_reason,''))) < 10 or char_length(p_reason)>1000 then
    raise exception 'A reason of at least 10 characters is required';
  end if;
  if not exists(select 1 from public.sx_threads t where t.id=p_thread_id) then raise exception 'chat not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'sx_staff_chat_open','sx_thread',p_thread_id,
    jsonb_build_object('reason',trim(p_reason),'old_status','not_opened_by_staff','new_status','opened_by_staff'));
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
declare v_message public.sx_messages%rowtype;
begin
  if (select auth.uid()) is null or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'A deletion reason of at least 8 characters is required'; end if;
  select * into v_message from public.sx_messages where id=p_message_id for update;
  if not found then raise exception 'message not found'; end if;
  if v_message.media_deleted_at is not null then raise exception 'message already removed'; end if;
  update public.sx_messages set body=null, media_deleted_at=now() where id=p_message_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'sx_staff_message_delete','sx_message',p_message_id,
    jsonb_build_object('thread_id',v_message.thread_id,'sender_id',v_message.sender_id,'reason',trim(p_reason),'old_status','visible','new_status','removed'));
end;
$$;

create or replace function app_private.sx_staff_create_ban(
  p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_target jsonb;
  v_existing boolean;
begin
  if v_uid is null or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then raise exception 'not authorized' using errcode='42501'; end if;
  if p_type not in ('user','ip','device') or char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'invalid ban request'; end if;
  if p_duration_minutes is not null and (p_duration_minutes<1 or p_duration_minutes>525600) then raise exception 'duration must be between 1 minute and 365 days'; end if;
  if (p_type='user' and (p_user_id is null or p_ip is not null or p_device_id is not null))
   or (p_type='ip' and (p_user_id is not null or p_ip is null or p_device_id is not null))
   or (p_type='device' and (p_user_id is not null or p_ip is not null or p_device_id is null)) then raise exception 'target does not match ban type'; end if;
  if p_type='user' then
    if p_user_id=v_uid or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'invalid target user'; end if;
    if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id and r.name in ('MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'))
      and not public.has_staff_role(array['OWNER']::public.staff_role[]) then raise exception 'only owner may ban staff'; end if;
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
    jsonb_build_object('type',p_type,'target',v_target,'reason',trim(p_reason),'duration_minutes',p_duration_minutes,'old_status','not_banned','new_status','active'));
  return v_id;
end;
$$;

create or replace function app_private.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ban public.sx_staff_bans%rowtype; v_target jsonb;
begin
  if (select auth.uid()) is null or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then raise exception 'not authorized' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'An unban reason of at least 8 characters is required'; end if;
  select * into v_ban from public.sx_staff_bans where id=p_ban_id and revoked_at is null for update;
  if not found or (v_ban.ends_at is not null and v_ban.ends_at<=now()) then raise exception 'active ban not found'; end if;
  update public.sx_staff_bans set revoked_at=now(),revoked_by=(select auth.uid()),revoke_reason=trim(p_reason) where id=p_ban_id;
  v_target:=case v_ban.ban_type when 'user' then jsonb_build_object('user_id',v_ban.target_user_id) when 'ip' then jsonb_build_object('ip',v_ban.target_ip::text) else jsonb_build_object('device_id',v_ban.target_device_id) end;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'sx_staff_ban_revoke','sx_staff_ban',p_ban_id,
    jsonb_build_object('type',v_ban.ban_type,'target',v_target,'reason',trim(p_reason),'ban_reason',v_ban.reason,'old_status','active','new_status','revoked'));
end;
$$;

create or replace function public.sx_staff_list_chats()
returns table(thread_id uuid,title text,created_at timestamptz,member_count bigint,last_message_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from app_private.sx_staff_list_chats() $$;
create or replace function public.sx_staff_read_chat(p_thread_id uuid,p_reason text)
returns table(message_id uuid,sender_id uuid,kind text,body text,created_at timestamptz,is_deleted boolean)
language sql security invoker set search_path = '' as $$ select * from app_private.sx_staff_read_chat(p_thread_id,p_reason) $$;
create or replace function public.sx_staff_delete_message(p_message_id uuid,p_reason text)
returns void language sql security invoker set search_path = '' as $$ select app_private.sx_staff_delete_message(p_message_id,p_reason) $$;
create or replace function public.sx_staff_create_ban(p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text)
returns uuid language sql security invoker set search_path = '' as $$ select app_private.sx_staff_create_ban(p_type,p_user_id,p_ip,p_device_id,p_duration_minutes,p_reason) $$;
create or replace function public.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language sql security invoker set search_path = '' as $$ select app_private.sx_staff_revoke_ban(p_ban_id,p_reason) $$;
revoke all on function public.sx_staff_list_chats() from public,anon;
revoke all on function public.sx_staff_read_chat(uuid,text) from public,anon;
revoke all on function public.sx_staff_delete_message(uuid,text) from public,anon;
revoke all on function public.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) from public,anon;
revoke all on function public.sx_staff_revoke_ban(uuid,text) from public,anon;
grant execute on function public.sx_staff_list_chats() to authenticated;
grant execute on function public.sx_staff_read_chat(uuid,text) to authenticated;
grant execute on function public.sx_staff_delete_message(uuid,text) to authenticated;
grant execute on function public.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) to authenticated;
grant execute on function public.sx_staff_revoke_ban(uuid,text) to authenticated;
grant execute on function app_private.sx_staff_list_chats() to authenticated;
grant execute on function app_private.sx_staff_read_chat(uuid,text) to authenticated;
grant execute on function app_private.sx_staff_delete_message(uuid,text) to authenticated;
grant execute on function app_private.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) to authenticated;
grant execute on function app_private.sx_staff_revoke_ban(uuid,text) to authenticated;

-- Staff deletion also removes message media from future signed URL authorization.
drop policy if exists sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id='snapshotx-media' and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (
      select 1 from public.sx_messages m where m.media_path=name and m.media_deleted_at is null
        and app_private.sx_is_member(m.thread_id) and m.expires_at>now()
        and (not m.view_once or exists (
          select 1 from public.sx_receipts r where r.message_id=m.id and r.user_id=(select auth.uid())
            and r.opened_at>now()-interval '90 seconds'
        ))
    )
    or exists (
      select 1 from public.sx_stories s where s.media_path=name
        and (s.owner_id=(select auth.uid()) or (s.expires_at>now() and
          (s.visibility='everyone' or exists (select 1 from public.sx_friends f where f.user_id=(select auth.uid()) and f.friend_id=s.owner_id))))
    )
  )
);
