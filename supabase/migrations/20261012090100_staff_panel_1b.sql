-- =====================================================================================================
-- NOT APPLIED YET. Written 2026-10-08 (phase 1b); has NOT been run against the live Supabase project.
-- Requires 20261012090000_staff_moderation_consolidated.sql (app_private.sx_require_staff & co).
-- Only tested on a throwaway local Postgres 17 with stubbed Supabase/legacy objects. Idempotent.
-- =====================================================================================================
-- Staff panel backend for phase 1b:
--   * sx_staff_search_users      server-side paginated user search (ILIKE username / display name, id prefix)
--   * sx_staff_dashboard_counts  dashboard numbers as counts (no rows shipped to the client)
--   * sx_staff_list_members      staff + roles for the role-management screen (ADMIN/OWNER)
--   * sx_manage_staff_role       owners can revoke every role they can grant; an owner may step down only
--                                while another active owner remains (no self-demotion of the last owner)
--   * sx_reports                 reported_user_id + content_snapshot captured server-side on insert,
--                                action_taken / action_ref / actioned_at for report -> action linkage
--   * sx_staff_warnings          warnings issued by staff (optionally from a report)
--   * sx_staff_remove_story      story / Spotlight takedown (audited)
--   * sx_staff_report_action     warn / ban user / delete content straight from a report; the action's own
--                                audit row and the report audit row both carry metadata.report_id
-- Every function re-checks app_private.sx_require_staff() inside the function body.
-- =====================================================================================================

-- ---------------------------------------------------------------- user search
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index if not exists profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);

create or replace function public.sx_staff_search_users(p_query text default '', p_limit integer default 25, p_offset integer default 0)
returns table(id uuid, username text, display_name text, created_at timestamptz, is_verified boolean, is_banned boolean, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := left(trim(coalesce(p_query,'')), 64);
  v_like text;
  v_id_prefix text;
  v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),10000);
begin
  perform app_private.sx_require_staff();
  -- Escape LIKE wildcards so '%' / '_' in the query are matched literally.
  v_like := '%' || replace(replace(replace(v_q,'\','\\'),'%','\%'),'_','\_') || '%';
  if lower(v_q) ~ '^[0-9a-f-]{4,36}$' then v_id_prefix := lower(v_q); end if;
  return query
    select p.id, p.username, p.display_name, p.created_at, coalesce(p.is_verified,false),
      exists(select 1 from public.sx_staff_bans b where b.ban_type='user' and b.target_user_id=p.id
        and b.revoked_at is null and (b.ends_at is null or b.ends_at>now())),
      count(*) over ()
    from public.profiles p
    where v_q=''
      or p.username ilike v_like escape '\'
      or p.display_name ilike v_like escape '\'
      or (v_id_prefix is not null and p.id::text like v_id_prefix || '%')
    order by (v_q<>'' and lower(coalesce(p.username,''))=lower(v_q)) desc, p.created_at desc nulls last, p.id
    limit v_limit offset v_offset;
end;
$$;
revoke all on function public.sx_staff_search_users(text,integer,integer) from public, anon;
grant execute on function public.sx_staff_search_users(text,integer,integer) to authenticated;

-- ---------------------------------------------------------------- warnings
create table if not exists public.sx_staff_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 8 and 1000),
  issued_by uuid references auth.users(id) on delete set null,
  report_id uuid references public.sx_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index if not exists sx_staff_warnings_user on public.sx_staff_warnings(user_id, created_at desc);
alter table public.sx_staff_warnings enable row level security;
revoke all on public.sx_staff_warnings from public, anon, authenticated;
grant select on public.sx_staff_warnings to authenticated;
drop policy if exists sx_staff_warnings_read on public.sx_staff_warnings;
create policy sx_staff_warnings_read on public.sx_staff_warnings for select to authenticated
using (user_id=(select auth.uid())
  or app_private.sx_staff_has_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']));
drop policy if exists sx_active_ban_guard on public.sx_staff_warnings;
create policy sx_active_ban_guard on public.sx_staff_warnings as restrictive for all to authenticated
using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned());

-- ---------------------------------------------------------------- report snapshot + action linkage
alter table public.sx_reports add column if not exists reported_user_id uuid references auth.users(id) on delete set null;
alter table public.sx_reports add column if not exists content_snapshot jsonb;
alter table public.sx_reports add column if not exists action_taken text;
alter table public.sx_reports add column if not exists action_ref uuid;
alter table public.sx_reports add column if not exists actioned_at timestamptz;
alter table public.sx_reports drop constraint if exists sx_reports_action_taken_check;
alter table public.sx_reports add constraint sx_reports_action_taken_check
  check (action_taken is null or action_taken in ('warn','ban_user','delete_content'));
create index if not exists sx_reports_reported_user on public.sx_reports(reported_user_id, created_at desc) where reported_user_id is not null;
alter table public.sx_stories add column if not exists removed_at timestamptz;

create or replace function app_private.sx_message_snapshot(p_message_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('type','message','message_id',m.id,'thread_id',m.thread_id,'sender_id',m.sender_id,
    'kind',m.kind,'body',m.body,'has_media',m.media_path is not null,'media_path',m.media_path,
    'view_once',m.view_once,'created_at',m.created_at,'captured_at',now())
  from public.sx_messages m where m.id=p_message_id;
$$;
create or replace function app_private.sx_story_snapshot(p_story_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('type','story','story_id',s.id,'owner_id',s.owner_id,'media_type',s.media_type,
    'caption',s.caption,'visibility',s.visibility,'has_media',true,'media_path',s.media_path,
    'created_at',s.created_at,'expires_at',s.expires_at,'captured_at',now())
  from public.sx_stories s where s.id=p_story_id;
$$;
revoke all on function app_private.sx_message_snapshot(uuid) from public, anon, authenticated;
revoke all on function app_private.sx_story_snapshot(uuid) from public, anon, authenticated;

-- Server-side capture: clients cannot set these columns (no column grant), the trigger always fills them.
create or replace function app_private.sx_report_capture()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.reported_user_id := null;
  new.content_snapshot := null;
  new.action_taken := null; new.action_ref := null; new.actioned_at := null;
  if new.message_id is not null then
    select m.sender_id into new.reported_user_id from public.sx_messages m where m.id=new.message_id;
    new.content_snapshot := app_private.sx_message_snapshot(new.message_id);
  elsif new.story_id is not null then
    select s.owner_id into new.reported_user_id from public.sx_stories s where s.id=new.story_id;
    new.content_snapshot := app_private.sx_story_snapshot(new.story_id);
  end if;
  return new;
end;
$$;
revoke all on function app_private.sx_report_capture() from public, anon, authenticated;
drop trigger if exists sx_reports_capture on public.sx_reports;
create trigger sx_reports_capture before insert on public.sx_reports
for each row execute function app_private.sx_report_capture();

-- Backfill existing reports whose content still exists (marked as captured later, not at report time).
update public.sx_reports r set reported_user_id=m.sender_id,
  content_snapshot=app_private.sx_message_snapshot(m.id) || jsonb_build_object('backfilled',true)
from public.sx_messages m where r.message_id=m.id and r.content_snapshot is null;
update public.sx_reports r set reported_user_id=s.owner_id,
  content_snapshot=app_private.sx_story_snapshot(s.id) || jsonb_build_object('backfilled',true)
from public.sx_stories s where r.story_id=s.id and r.content_snapshot is null;

-- ---------------------------------------------------------------- story / Spotlight takedown
create or replace function app_private.sx_staff_remove_story(p_story_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(); v_story public.sx_stories%rowtype;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'A removal reason of at least 8 characters is required'; end if;
  select * into v_story from public.sx_stories where id=p_story_id for update;
  if not found then raise exception 'story not found'; end if;
  if v_story.removed_at is not null then raise exception 'story already removed'; end if;
  -- Expire now: hidden for viewers by the existing expiry rules; cleanup-media later deletes the file.
  update public.sx_stories set removed_at=now(), expires_at=least(expires_at, now()) where id=p_story_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_story_remove','sx_story',p_story_id,
    app_private.sx_audit_meta(jsonb_build_object('owner_id',v_story.owner_id,'target',jsonb_build_object('user_id',v_story.owner_id),
      'visibility',v_story.visibility,'reason',trim(p_reason),'old_status','visible','new_status','removed')));
end;
$$;
revoke all on function app_private.sx_staff_remove_story(uuid,text) from public, anon, authenticated;
create or replace function public.sx_staff_remove_story(p_story_id uuid, p_reason text)
returns void language sql security definer set search_path = '' as $$ select app_private.sx_staff_remove_story(p_story_id,p_reason) $$;
revoke all on function public.sx_staff_remove_story(uuid,text) from public, anon;
grant execute on function public.sx_staff_remove_story(uuid,text) to authenticated;

-- ---------------------------------------------------------------- take action from a report
create or replace function public.sx_staff_report_action(
  p_report_id uuid, p_action text, p_reason text, p_duration_minutes integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.sx_require_staff();
  v_report public.sx_reports%rowtype;
  v_ref uuid;
begin
  if p_action is null or p_action not in ('warn','ban_user','delete_content') then raise exception 'invalid action'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason)>1000 then raise exception 'A reason of at least 8 characters is required'; end if;
  if p_action<>'ban_user' and p_duration_minutes is not null then raise exception 'duration only applies to bans'; end if;
  select * into v_report from public.sx_reports where id=p_report_id for update;
  if not found then raise exception 'report not found'; end if;
  if v_report.status not in ('open','reviewing') then raise exception 'report already closed'; end if;

  perform set_config('snapshotx.report_id', p_report_id::text, true);
  if p_action='delete_content' then
    if v_report.message_id is not null then
      perform app_private.sx_staff_delete_message(v_report.message_id, p_reason); v_ref := v_report.message_id;
    elsif v_report.story_id is not null then
      perform app_private.sx_staff_remove_story(v_report.story_id, p_reason); v_ref := v_report.story_id;
    else
      raise exception 'reported content no longer exists';
    end if;
  else
    if v_report.reported_user_id is null then raise exception 'reported user unknown'; end if;
    if p_action='ban_user' then
      v_ref := app_private.sx_staff_create_ban('user', v_report.reported_user_id, null, null, p_duration_minutes, p_reason);
    else
      if v_report.reported_user_id=v_uid then raise exception 'invalid target user'; end if;
      insert into public.sx_staff_warnings(user_id, reason, issued_by, report_id)
      values(v_report.reported_user_id, trim(p_reason), v_uid, p_report_id) returning id into v_ref;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(v_uid,'sx_staff_warning_create','sx_staff_warning',v_ref,
        app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',v_report.reported_user_id),
          'reason',trim(p_reason),'old_status','no_warning','new_status','warned')));
    end if;
  end if;

  update public.sx_reports set status='resolved', reviewer_id=v_uid, reviewed_at=now(), review_note=trim(p_reason),
    action_taken=p_action, action_ref=v_ref, actioned_at=now()
  where id=p_report_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_staff_report_action','sx_report',p_report_id,
    app_private.sx_audit_meta(jsonb_build_object('action',p_action,'action_ref',v_ref,'reason',trim(p_reason),
      'duration_minutes',p_duration_minutes,'target',jsonb_build_object('user_id',v_report.reported_user_id),
      'old_status',v_report.status,'new_status','resolved')));
  perform set_config('snapshotx.report_id', '', true);
  return jsonb_build_object('report_id',p_report_id,'action',p_action,'action_ref',v_ref);
end;
$$;
revoke all on function public.sx_staff_report_action(uuid,text,text,integer) from public, anon;
grant execute on function public.sx_staff_report_action(uuid,text,text,integer) to authenticated;

-- ---------------------------------------------------------------- dashboard counts
create or replace function public.sx_staff_dashboard_counts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.sx_require_staff();
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles p where p.created_at > now()-interval '7 days'),
    'reports_open', (select count(*) from public.sx_reports r where r.status='open'),
    'reports_reviewing', (select count(*) from public.sx_reports r where r.status='reviewing'),
    'reports_24h', (select count(*) from public.sx_reports r where r.created_at > now()-interval '24 hours'),
    'bans_active', (select count(*) from public.sx_staff_bans b where b.revoked_at is null and (b.ends_at is null or b.ends_at>now())),
    'bans_active_user', (select count(*) from public.sx_staff_bans b where b.ban_type='user' and b.revoked_at is null and (b.ends_at is null or b.ends_at>now())),
    'warnings_30d', (select count(*) from public.sx_staff_warnings w where w.created_at > now()-interval '30 days'),
    'chats_total', (select count(*) from public.sx_threads),
    'generated_at', now());
end;
$$;
revoke all on function public.sx_staff_dashboard_counts() from public, anon;
grant execute on function public.sx_staff_dashboard_counts() to authenticated;

-- ---------------------------------------------------------------- role management
create or replace function public.sx_staff_list_members()
returns table(user_id uuid, username text, display_name text, roles text[], is_banned boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform app_private.sx_require_staff(array['ADMIN','OWNER']);
  return query
    select ur.user_id, p.username, p.display_name,
      array_agg(r.name::text order by array_position(array['OWNER','ADMIN','SENIOR MODERATOR','MODERATOR'], r.name::text)),
      exists(select 1 from public.sx_staff_bans b where b.ban_type='user' and b.target_user_id=ur.user_id
        and b.revoked_at is null and (b.ends_at is null or b.ends_at>now()))
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    left join public.profiles p on p.id=ur.user_id
    where r.name::text in ('MODERATOR','SENIOR MODERATOR','ADMIN','OWNER')
    group by ur.user_id, p.username, p.display_name
    order by min(array_position(array['OWNER','ADMIN','SENIOR MODERATOR','MODERATOR'], r.name::text)), p.username nulls last;
end;
$$;
revoke all on function public.sx_staff_list_members() from public, anon;
grant execute on function public.sx_staff_list_members() to authenticated;

-- OWNER grants/revokes MODERATOR, SENIOR MODERATOR, ADMIN; ADMIN grants/revokes MODERATOR (never on an owner).
-- OWNER is never granted here (initial/extra owners stay an explicit bootstrap action). An owner may revoke
-- their OWNER role themselves only while at least one other active, non-banned owner remains.
create or replace function public.sx_manage_staff_role(p_user_id uuid,p_role public.staff_role,p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.sx_require_staff(array['ADMIN','OWNER']);
  v_is_owner boolean := app_private.sx_staff_has_role(array['OWNER']);
  v_role_id uuid;
  v_other_owners integer;
begin
  if p_user_id is null or p_role is null or p_grant is null then raise exception 'invalid role change'; end if;
  select id into v_role_id from public.roles where name=p_role;
  if v_role_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'target not found'; end if;

  if p_role::text='OWNER' then
    if p_grant or p_user_id<>v_uid or not v_is_owner then raise exception 'not authorized' using errcode='42501'; end if;
    -- Serialize concurrent owner step-downs so two owners cannot both leave.
    perform pg_advisory_xact_lock(hashtext('snapshotx.owner_roles'));
    select count(*) into v_other_owners
    from public.user_roles ur join public.roles r on r.id=ur.role_id
    join auth.users u on u.id=ur.user_id
    where r.name::text='OWNER' and ur.user_id<>v_uid
      and not exists(select 1 from app_private.sx_deletion_pending d where d.user_id=ur.user_id)
      and not exists(select 1 from public.sx_staff_bans b where b.ban_type='user' and b.target_user_id=ur.user_id
        and b.revoked_at is null and (b.ends_at is null or b.ends_at>now()));
    if v_other_owners=0 then raise exception 'cannot remove the last owner' using errcode='42501'; end if;
  elsif p_role::text in ('MODERATOR','SENIOR MODERATOR','ADMIN') then
    if p_user_id=v_uid then raise exception 'not authorized' using errcode='42501'; end if;
    if not (v_is_owner or (p_role::text='MODERATOR' and app_private.sx_staff_has_role(array['ADMIN']))) then
      raise exception 'not authorized' using errcode='42501';
    end if;
    if not v_is_owner and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=p_user_id and r.name::text='OWNER') then
      raise exception 'not authorized' using errcode='42501';
    end if;
  else
    raise exception 'not authorized' using errcode='42501';
  end if;

  if p_grant then
    insert into public.user_roles(user_id,role_id,granted_by) values(p_user_id,v_role_id,v_uid)
    on conflict(user_id,role_id) do nothing;
  else
    delete from public.user_roles where user_id=p_user_id and role_id=v_role_id;
    if not found then raise exception 'role not assigned'; end if;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'sx_manage_staff_role','user',p_user_id,
    jsonb_build_object('role',p_role,'grant',p_grant,'self',p_user_id=v_uid,'target',jsonb_build_object('user_id',p_user_id)));
end;
$$;
revoke all on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) from public, anon;
grant execute on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) to authenticated;

-- ---------------------------------------------------------------- audit visibility
-- Admins and owners read the whole audit log (role changes included); moderators keep the
-- moderation-only view from 20261012090000.
drop policy if exists sx_audit_logs_admin_read on public.audit_logs;
create policy sx_audit_logs_admin_read on public.audit_logs for select to authenticated
using (not app_private.sx_request_is_banned() and app_private.sx_staff_has_role(array['ADMIN','OWNER']));
