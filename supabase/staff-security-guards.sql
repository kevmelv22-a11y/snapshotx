-- Restrict direct staff-history reads for banned staff and preserve the moderator audit view.
drop policy if exists sx_login_history_staff_read on public.sx_login_history;
create policy sx_login_history_staff_read on public.sx_login_history for select to authenticated
using (public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) and not app_private.sx_request_is_banned());
drop policy if exists sx_staff_bans_staff_read on public.sx_staff_bans;
create policy sx_staff_bans_staff_read on public.sx_staff_bans for select to authenticated
using (public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) and not app_private.sx_request_is_banned());
drop policy if exists sx_audit_logs_moderation_read on public.audit_logs;
create policy sx_audit_logs_moderation_read on public.audit_logs for select to authenticated
using (
  not app_private.sx_request_is_banned()
  and public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[])
  and (action like 'sx_staff_%' or action='sx_review_report')
);
drop policy if exists sx_login_history_not_banned on public.sx_login_history;
create policy sx_login_history_not_banned on public.sx_login_history as restrictive for select to authenticated
using (not app_private.sx_request_is_banned());
drop policy if exists sx_staff_bans_not_banned on public.sx_staff_bans;
create policy sx_staff_bans_not_banned on public.sx_staff_bans as restrictive for select to authenticated
using (not app_private.sx_request_is_banned());

create or replace function public.sx_manage_staff_role(p_user_id uuid,p_role public.staff_role,p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role_id uuid;
begin
  if auth.uid() is null or app_private.sx_request_is_banned() or p_user_id=auth.uid()
    or not (public.has_staff_role(array['OWNER']::public.staff_role[])
      or (p_role='MODERATOR' and public.has_staff_role(array['ADMIN']::public.staff_role[])))
    or p_role not in ('MODERATOR','SENIOR MODERATOR','ADMIN') then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select id into v_role_id from public.roles where name=p_role;
  if v_role_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'target not found'; end if;
  if p_grant then
    insert into public.user_roles(user_id,role_id,granted_by) values(p_user_id,v_role_id,auth.uid())
    on conflict(user_id,role_id) do nothing;
  else
    delete from public.user_roles where user_id=p_user_id and role_id=v_role_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'sx_manage_staff_role','user',p_user_id,jsonb_build_object('role',p_role,'grant',p_grant));
end;
$$;
revoke all on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) from public,anon;
grant execute on function public.sx_manage_staff_role(uuid,public.staff_role,boolean) to authenticated;

create or replace function public.sx_review_report(p_report_id uuid,p_status public.report_status,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app_private.sx_request_is_banned()
    or not public.has_staff_role(array['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER']::public.staff_role[]) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_status not in ('reviewing','resolved','dismissed') or char_length(coalesce(p_note,''))>1000 then raise exception 'invalid review'; end if;
  update public.sx_reports set status=p_status,reviewer_id=auth.uid(),review_note=p_note,reviewed_at=now() where id=p_report_id;
  if not found then raise exception 'report not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'sx_review_report','sx_report',p_report_id,jsonb_build_object('status',p_status,'note',p_note));
end;
$$;
revoke all on function public.sx_review_report(uuid,public.report_status,text) from public,anon;
grant execute on function public.sx_review_report(uuid,public.report_status,text) to authenticated;

-- Keep storage access conditional on a live authorized session and ban status.
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
