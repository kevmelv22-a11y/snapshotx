-- Step 11 (staff panel): direct warnings, staff X+ grants, per-user moderation summary. Applied live 2026-10-31.
-- Uses app_private.sx_require_staff / sx_audit_meta from 20261012090000 and sx_entitlements from 20261013120100.

create or replace function public.sx_staff_warn_user(p_user_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(); v_id uuid;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason) > 1000 then raise exception 'A reason of at least 8 characters is required'; end if;
  if p_user_id is null or p_user_id = v_uid or not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'invalid target user'; end if;
  insert into public.sx_staff_warnings(user_id, reason, issued_by) values (p_user_id, trim(p_reason), v_uid) returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values (v_uid,'sx_staff_warning_create','sx_staff_warning',v_id,
    app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'old_status','no_warning','new_status','warned')));
  return v_id;
end $$;
revoke all on function public.sx_staff_warn_user(uuid,text) from public, anon;
grant execute on function public.sx_staff_warn_user(uuid,text) to authenticated;

-- ADMIN/OWNER only. Grants create a source='staff' entitlement; revoke only touches staff grants (never store purchases).
create or replace function public.sx_staff_set_plus(p_user_id uuid, p_grant boolean, p_days integer, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(array['ADMIN','OWNER']); v_id uuid; v_was boolean;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason) > 1000 then raise exception 'A reason of at least 8 characters is required'; end if;
  if p_user_id is null or not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'invalid target user'; end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'days must be between 1 and 3650'; end if;
  perform pg_advisory_xact_lock(hashtext('snapshotx.staff_plus.' || p_user_id::text));
  v_was := public.sx_is_plus(p_user_id);
  if p_grant then
    if exists(select 1 from public.sx_entitlements where user_id=p_user_id and source='staff' and status='active') then raise exception 'user already has a staff X+ grant'; end if;
    insert into public.sx_entitlements(user_id,tier,source,status,expires_at,will_renew)
    values (p_user_id,'plus','staff','active',case when p_days is null then null else now()+make_interval(days=>p_days) end,false) returning id into v_id;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (v_uid,'sx_staff_plus_grant','sx_entitlement',v_id,
      app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'days',p_days,'old_status',case when v_was then 'plus' else 'free' end,'new_status','plus')));
  else
    update public.sx_entitlements set status='revoked', updated_at=now() where user_id=p_user_id and source='staff' and status='active' returning id into v_id;
    if v_id is null then raise exception 'no staff X+ grant to revoke'; end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (v_uid,'sx_staff_plus_revoke','sx_entitlement',v_id,
      app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'old_status','plus','new_status',case when public.sx_is_plus(p_user_id) then 'plus' else 'free' end)));
  end if;
  return v_id;
end $$;
revoke all on function public.sx_staff_set_plus(uuid,boolean,integer,text) from public, anon;
grant execute on function public.sx_staff_set_plus(uuid,boolean,integer,text) to authenticated;

create or replace function public.sx_staff_user_moderation(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.sx_require_staff();
  return jsonb_build_object(
    'warnings', (select count(*) from public.sx_staff_warnings where user_id = p_user_id),
    'plus', public.sx_is_plus(p_user_id),
    'plus_source', (select source from public.sx_entitlements where user_id=p_user_id and status in ('active','grace') and (expires_at is null or expires_at>now()) order by (source='staff') desc limit 1),
    'banned', exists(select 1 from public.sx_staff_bans b where b.ban_type='user' and b.target_user_id=p_user_id and b.revoked_at is null and (b.ends_at is null or b.ends_at>now())));
end $$;
revoke all on function public.sx_staff_user_moderation(uuid) from public, anon;
grant execute on function public.sx_staff_user_moderation(uuid) to authenticated;
