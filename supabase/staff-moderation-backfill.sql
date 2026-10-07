-- Import historic account bans/suspensions and preserve the existing media and block policies.
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

insert into public.sx_staff_bans(ban_type,target_user_id,reason,issued_by,created_at,ends_at,legacy_source,legacy_id)
select 'user',b.user_id,coalesce(nullif(trim(b.reason),''),'Legacy ban (reason not provided)'),b.issued_by,b.created_at,null,'bans',b.id
from public.bans b
where not exists(select 1 from public.sx_staff_bans n where n.legacy_source='bans' and n.legacy_id=b.id);

insert into public.sx_staff_bans(ban_type,target_user_id,reason,issued_by,created_at,ends_at,legacy_source,legacy_id)
select 'user',s.user_id,coalesce(nullif(trim(s.reason),''),'Legacy suspension (reason not provided)'),s.issued_by,s.starts_at,s.ends_at,'suspensions',s.id
from public.suspensions s
where s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())
  and not exists(select 1 from public.sx_staff_bans n where n.legacy_source='suspensions' and n.legacy_id=s.id);

-- Every staff RPC re-checks the active app ban before doing privileged work.
create or replace function public.sx_staff_list_chats()
returns table(thread_id uuid,title text,created_at timestamptz,member_count bigint,last_message_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  return query select * from app_private.sx_staff_list_chats();
end;
$$;
create or replace function public.sx_staff_read_chat(p_thread_id uuid,p_reason text)
returns table(message_id uuid,sender_id uuid,kind text,body text,created_at timestamptz,is_deleted boolean)
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  return query select * from app_private.sx_staff_read_chat(p_thread_id,p_reason);
end;
$$;
create or replace function public.sx_staff_delete_message(p_message_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  perform app_private.sx_staff_delete_message(p_message_id,p_reason);
end;
$$;
create or replace function public.sx_staff_create_ban(p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  return app_private.sx_staff_create_ban(p_type,p_user_id,p_ip,p_device_id,p_duration_minutes,p_reason);
end;
$$;
create or replace function public.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  perform app_private.sx_staff_revoke_ban(p_ban_id,p_reason);
end;
$$;

create or replace function public.sx_check_app_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and not app_private.sx_request_is_banned();
$$;
revoke all on function public.sx_check_app_access() from public,anon;
grant execute on function public.sx_check_app_access() to authenticated;

-- Keep the existing block, expiry, receipt, and owner rules, and suppress deleted media.
drop policy if exists sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id='snapshotx-media'
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
