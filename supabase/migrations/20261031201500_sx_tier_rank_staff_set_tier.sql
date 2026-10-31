-- Tier hierarchy on the server + staff grant/revoke of any tier. Idempotent (create or replace only).
-- Ranking mirrors lib/plus.ts RANK: storage 0 < plus = family 1 < lens 2 < platinum 3. A higher tier includes the lower ones,
-- so sx_is_plus() is true for family/lens/platinum too (before: only tier='plus' counted).
create or replace function app_private.sx_tier_rank(p_tier text) returns integer
language sql immutable set search_path = '' as $$
  select case p_tier when 'storage' then 0 when 'plus' then 1 when 'family' then 1 when 'lens' then 2 when 'platinum' then 3 else -1 end
$$;
revoke all on function app_private.sx_tier_rank(text) from public, anon;
grant execute on function app_private.sx_tier_rank(text) to authenticated;

create or replace function app_private.sx_has_tier(uid uuid, want text default 'plus')
returns boolean language sql stable security definer set search_path = 'public' as $$
  select exists (
    select 1 from public.sx_entitlements e
    where e.user_id = uid and app_private.sx_tier_rank(e.tier) >= app_private.sx_tier_rank(want) and app_private.sx_tier_rank(want) >= 0
      and e.status not in ('revoked','refunded')
      and e.starts_at <= now()
      and (e.expires_at is null and e.status = 'active' or e.expires_at > now() or e.grace_until > now())
  );
$$;

-- Highest live tier of a user (null = free).
create or replace function app_private.sx_user_tier(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select e.tier from public.sx_entitlements e
  where e.user_id = uid and e.status not in ('revoked','refunded') and e.starts_at <= now()
    and (e.expires_at is null and e.status = 'active' or e.expires_at > now() or e.grace_until > now())
  order by app_private.sx_tier_rank(e.tier) desc limit 1
$$;
revoke all on function app_private.sx_user_tier(uuid) from public, anon, authenticated;

-- Owner/admin: grant (or change) the staff tier of a user, or revoke staff grants. Every call writes audit_logs.
-- Re-granting the same tier with the same expiry is idempotent: no new row, audit action 'sx_staff_tier_reaffirm'.
create or replace function public.sx_staff_set_tier(p_user_id uuid, p_tier text, p_grant boolean, p_days integer, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff(array['ADMIN','OWNER']); v_id uuid; v_old text; v_cur public.sx_entitlements%rowtype; v_exp timestamptz;
begin
  if char_length(trim(coalesce(p_reason,''))) < 8 or char_length(p_reason) > 1000 then raise exception 'A reason of at least 8 characters is required'; end if;
  if p_user_id is null or not exists(select 1 from public.profiles where id = p_user_id) then raise exception 'invalid target user'; end if;
  if p_grant and (p_tier is null or p_tier not in ('plus','family','lens','platinum','storage')) then raise exception 'invalid tier'; end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'days must be between 1 and 3650'; end if;
  perform pg_advisory_xact_lock(hashtext('snapshotx.staff_plus.' || p_user_id::text));
  v_old := coalesce(app_private.sx_user_tier(p_user_id), 'free');
  select * into v_cur from public.sx_entitlements where user_id=p_user_id and source='staff' and status='active' order by app_private.sx_tier_rank(tier) desc limit 1;
  if p_grant then
    v_exp := case when p_days is null then null else now()+make_interval(days=>p_days) end;
    if v_cur.id is not null and v_cur.tier = p_tier and p_days is null and v_cur.expires_at is null then
      v_id := v_cur.id;
      insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (v_uid,'sx_staff_tier_reaffirm','sx_entitlement',v_id,
        app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'tier',p_tier,'days',p_days,'old_status',v_old,'new_status',v_old)));
      return v_id;
    end if;
    -- One active staff grant per user: replace any previous one.
    update public.sx_entitlements set status='revoked', updated_at=now() where user_id=p_user_id and source='staff' and status='active';
    insert into public.sx_entitlements(user_id,tier,source,status,expires_at,will_renew) values (p_user_id,p_tier,'staff','active',v_exp,false) returning id into v_id;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (v_uid,'sx_staff_tier_grant','sx_entitlement',v_id,
      app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'tier',p_tier,'days',p_days,
        'replaced',v_cur.id,'old_status',v_old,'new_status',coalesce(app_private.sx_user_tier(p_user_id),'free'))));
  else
    with u as (update public.sx_entitlements set status='revoked', updated_at=now()
      where user_id=p_user_id and source='staff' and status='active' and (p_tier is null or tier=p_tier) returning id)
    select (array_agg(id))[1] into v_id from u;
    if v_id is null then raise exception 'no staff grant to revoke'; end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (v_uid,'sx_staff_tier_revoke','sx_entitlement',v_id,
      app_private.sx_audit_meta(jsonb_build_object('target',jsonb_build_object('user_id',p_user_id),'reason',trim(p_reason),'tier',coalesce(p_tier,v_cur.tier),
        'old_status',v_old,'new_status',coalesce(app_private.sx_user_tier(p_user_id),'free'))));
  end if;
  return v_id;
end $$;
revoke all on function public.sx_staff_set_tier(uuid,text,boolean,integer,text) from public, anon;
grant execute on function public.sx_staff_set_tier(uuid,text,boolean,integer,text) to authenticated;

-- Moderation summary now also reports the highest tier.
create or replace function public.sx_staff_user_moderation(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.sx_require_staff();
  return jsonb_build_object(
    'warnings', (select count(*) from public.sx_staff_warnings where user_id = p_user_id),
    'plus', public.sx_is_plus(p_user_id),
    'tier', app_private.sx_user_tier(p_user_id),
    'plus_source', (select source from public.sx_entitlements where user_id=p_user_id and status in ('active','grace') and (expires_at is null or expires_at>now()) order by (source='staff') desc, app_private.sx_tier_rank(tier) desc limit 1),
    'banned', exists(select 1 from public.sx_staff_bans b where b.ban_type='user' and b.target_user_id=p_user_id and b.revoked_at is null and (b.ends_at is null or b.ends_at>now())));
end $$;
