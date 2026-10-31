-- Applied live 2026-10-31: the staff helpers from 20261012090000 (live DB only had an older variant of that migration).
-- Only the three missing helpers; the rest of 090000 is NOT re-run (it would overwrite newer storage/chat policies). Idempotent.
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
