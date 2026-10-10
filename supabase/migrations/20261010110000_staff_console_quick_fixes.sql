-- Staff console quick fixes. This migration is source-only until it is reviewed
-- and applied to an isolated test database. Never apply it to production from this task.
begin;

-- Keep IP-ban decisions consistent with record-login-history. Do not trust a
-- client-provided x-forwarded-for fallback when the proxy headers are absent.
create or replace function app_private.sx_request_is_banned()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
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
  v_ip_text := coalesce(nullif(trim(v_headers->>'cf-connecting-ip'), ''), nullif(trim(v_headers->>'x-real-ip'), ''));
  if v_ip_text is not null then
    begin v_ip := v_ip_text::inet; exception when others then v_ip := null; end;
  end if;
  v_device_text := nullif(trim(v_headers->>'x-snaplion-device-id'), '');
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

create or replace function public.sx_staff_search_users(
  p_query text default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  username text,
  display_name text,
  created_at timestamptz,
  is_verified boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit integer := coalesce(p_limit, 50);
begin
  if v_uid is null
    or app_private.sx_request_is_banned()
    or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if char_length(v_query) > 100 or v_limit < 1 or v_limit > 100 then
    raise exception 'invalid search request';
  end if;

  return query
    select p.id, p.username, p.display_name, p.created_at, p.is_verified
    from public.profiles p
    where (p_after_id is null or p.id > p_after_id)
      and (
        v_query = ''
        or strpos(lower(coalesce(p.username, '')), v_query) > 0
        or strpos(lower(coalesce(p.display_name, '')), v_query) > 0
        or strpos(lower(p.id::text), v_query) > 0
      )
    order by p.id asc
    limit v_limit;
end;
$$;
revoke all on function public.sx_staff_search_users(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.sx_staff_search_users(text, uuid, integer) to authenticated;

create or replace function public.sx_staff_stats()
returns table(
  user_count bigint,
  open_report_count bigint,
  active_ban_count bigint,
  conversation_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null
    or app_private.sx_request_is_banned()
    or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select
      (select count(*) from public.profiles),
      (select count(*) from public.sx_reports where status in ('open', 'reviewing')),
      (select count(*) from public.sx_staff_bans b
        where b.revoked_at is null and (b.ends_at is null or b.ends_at > now())),
      (select count(*) from public.sx_threads);
end;
$$;
revoke all on function public.sx_staff_stats() from public, anon, authenticated;
grant execute on function public.sx_staff_stats() to authenticated;

-- Return only the reported target's current text/caption. Do not expose a media
-- storage path or bypass expiry; every inspection is reasoned and audited.
create or replace function public.sx_staff_report_context(
  p_report_id uuid,
  p_reason text
)
returns table(
  target_type text,
  target_id uuid,
  target_user_id uuid,
  target_created_at timestamptz,
  content_text text,
  content_kind text,
  has_media boolean,
  is_expired boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report record;
  v_target record;
  v_target_type text;
begin
  if v_uid is null
    or app_private.sx_request_is_banned()
    or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 or char_length(p_reason) > 1000 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  select r.id, r.message_id, r.story_id
    into v_report
    from public.sx_reports r
    where r.id = p_report_id;
  if not found then
    raise exception 'report not found';
  end if;

  v_target_type := case
    when v_report.message_id is not null then 'message'
    when v_report.story_id is not null then 'story'
    else 'unavailable'
  end;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(v_uid, 'sx_staff_report_context', 'sx_report', p_report_id,
    jsonb_build_object('target_type', v_target_type, 'reason', trim(p_reason)));

  if v_report.message_id is not null then
    select m.id as target_id, m.sender_id as target_user_id, m.created_at as target_created_at,
      case when m.expires_at is not null and m.expires_at <= now() then null else m.body end as content_text,
      m.kind::text as content_kind, (m.media_path is not null) as has_media,
      coalesce(m.expires_at is not null and m.expires_at <= now(), false) as is_expired
      into v_target
      from public.sx_messages m
      where m.id = v_report.message_id;
    if found then
      return query select 'message'::text, v_target.target_id, v_target.target_user_id,
        v_target.target_created_at, v_target.content_text, v_target.content_kind,
        v_target.has_media, v_target.is_expired;
      return;
    end if;
  elsif v_report.story_id is not null then
    select s.id as target_id, s.owner_id as target_user_id, s.created_at as target_created_at,
      case when s.expires_at <= now() then null else s.caption end as content_text,
      s.media_type::text as content_kind, true as has_media,
      (s.expires_at <= now()) as is_expired
      into v_target
      from public.sx_stories s
      where s.id = v_report.story_id;
    if found then
      return query select 'story'::text, v_target.target_id, v_target.target_user_id,
        v_target.target_created_at, v_target.content_text, v_target.content_kind,
        v_target.has_media, v_target.is_expired;
      return;
    end if;
  end if;

  return query select 'unavailable'::text, null::uuid, null::uuid, null::timestamptz,
    null::text, null::text, false, false;
end;
$$;
revoke all on function public.sx_staff_report_context(uuid, text) from public, anon, authenticated;
grant execute on function public.sx_staff_report_context(uuid, text) to authenticated;

-- Only OWNER may enumerate current staff assignments; regular moderators do
-- not receive an unnecessary roster of privileged accounts.
create or replace function public.sx_staff_list_roles(
  p_after_id uuid default null,
  p_limit integer default 50
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  role_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := coalesce(p_limit, 50);
begin
  if v_uid is null
    or app_private.sx_request_is_banned()
    or not public.has_staff_role(array['OWNER']::public.staff_role[])
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_limit < 1 or v_limit > 100 then
    raise exception 'invalid page size';
  end if;

  return query
    select p.id, p.username, p.display_name, array_agg(r.name::text order by r.name::text)
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where p.id > coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and r.name::text = any(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::text[])
    group by p.id, p.username, p.display_name
    order by p.id asc
    limit v_limit;
end;
$$;
revoke all on function public.sx_staff_list_roles(uuid, integer) from public, anon, authenticated;
grant execute on function public.sx_staff_list_roles(uuid, integer) to authenticated;

commit;
