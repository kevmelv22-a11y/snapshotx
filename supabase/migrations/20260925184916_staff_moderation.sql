-- Applied to the live project with the owner's approval on 2026-09-25 UTC.
-- Uses existing roles/user_roles/audit_logs. No bulk chat access or ban action.
create table public.sx_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.sx_messages(id) on delete set null,
  story_id uuid references public.sx_stories(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status public.report_status not null default 'open',
  reviewer_id uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- A deleted source may leave the report for audit, with both references null.
  constraint sx_report_one_target check (num_nonnulls(message_id, story_id) <= 1)
);
create index sx_reports_queue on public.sx_reports(status, created_at desc);
create index sx_reports_reporter on public.sx_reports(reporter_id, created_at desc);
create index sx_reports_message on public.sx_reports(message_id) where message_id is not null;
create index sx_reports_story on public.sx_reports(story_id) where story_id is not null;
alter table public.sx_reports enable row level security;
revoke all on public.sx_reports from public, anon, authenticated;
grant select, insert (reporter_id, message_id, story_id, reason) on public.sx_reports to authenticated;

create policy sx_reports_read on public.sx_reports for select to authenticated
using (reporter_id = (select auth.uid()) or
  (select public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])));

create policy sx_reports_send on public.sx_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid()) and status = 'open' and
  reviewer_id is null and review_note is null and reviewed_at is null and
  (
    (message_id is not null and exists (
      select 1 from public.sx_messages m where m.id = message_id
        and app_private.sx_is_member(m.thread_id)
    )) or
    (story_id is not null and exists (
      select 1 from public.sx_stories s where s.id = story_id
    ))
  )
);

-- Status changes are server-validated and audited. No client UPDATE grant.
create or replace function public.sx_review_report(
  p_report_id uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_staff_role(
    array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('reviewing','resolved','dismissed') or
     char_length(coalesce(p_note,'')) > 1000 then
    raise exception 'invalid review';
  end if;
  update public.sx_reports set status = p_status, reviewer_id = auth.uid(),
    review_note = p_note, reviewed_at = now() where id = p_report_id;
  if not found then raise exception 'report not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'sx_review_report', 'sx_report', p_report_id,
    jsonb_build_object('status', p_status, 'note', p_note));
end; $$;
revoke all on function public.sx_review_report(uuid, public.report_status, text)
  from public, anon, authenticated;
grant execute on function public.sx_review_report(uuid, public.report_status, text)
  to authenticated;

-- OWNER can assign non-owner staff; ADMIN can assign MODERATOR only.
-- Initial OWNER assignment remains a separate, explicit bootstrap action.
create or replace function public.sx_manage_staff_role(
  p_user_id uuid, p_role public.staff_role, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role_id uuid;
begin
  if auth.uid() is null or p_user_id = auth.uid() or
    not (public.has_staff_role(array['OWNER']::public.staff_role[]) or
      (p_role = 'MODERATOR' and public.has_staff_role(array['ADMIN']::public.staff_role[]))) or
    p_role not in ('MODERATOR','SENIOR MODERATOR','ADMIN') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into v_role_id from public.roles where name = p_role;
  if v_role_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'target not found';
  end if;
  if p_grant then
    insert into public.user_roles(user_id, role_id, granted_by)
    values(p_user_id, v_role_id, auth.uid()) on conflict (user_id,role_id) do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role_id = v_role_id;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'sx_manage_staff_role', 'user', p_user_id,
    jsonb_build_object('role', p_role, 'grant', p_grant));
end; $$;
revoke all on function public.sx_manage_staff_role(uuid, public.staff_role, boolean)
  from public, anon, authenticated;
grant execute on function public.sx_manage_staff_role(uuid, public.staff_role, boolean)
  to authenticated;
