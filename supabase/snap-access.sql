-- Run after schema.sql and fixes.sql. A snap can be opened once and replayed once.
-- A signed Storage URL may remain usable until its own short expiry.
alter table public.sx_receipts alter column opened_at set not null;
revoke insert, update, delete on public.sx_receipts from authenticated;
drop policy if exists sx_receipts_insert on public.sx_receipts;
drop policy if exists sx_receipts_update on public.sx_receipts;

create schema if not exists app_private;
create or replace function app_private.sx_claim_snap_internal(p_message_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_message public.sx_messages%rowtype;
        v_receipt public.sx_receipts%rowtype;
        v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  select * into v_message from public.sx_messages
    where id = p_message_id and view_once and media_path is not null
      and expires_at > now() and sender_id <> v_uid
    for share;
  if not found or not exists (
    select 1 from public.sx_members where thread_id=v_message.thread_id and user_id=v_uid
  ) then return false; end if;
  insert into public.sx_receipts(message_id,user_id,opened_at,replay_count)
    values(p_message_id,v_uid,now(),0) on conflict do nothing;
  if found then return true; end if;
  select * into v_receipt from public.sx_receipts
    where message_id=p_message_id and user_id=v_uid for update;
  if v_receipt.replay_count >= 1 then return false; end if;
  update public.sx_receipts set replay_count=1, opened_at=now()
    where message_id=p_message_id and user_id=v_uid;
  return true;
end $$;
revoke all on function app_private.sx_claim_snap_internal(uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.sx_claim_snap_internal(uuid) to authenticated;
create or replace function public.sx_claim_snap(p_message_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select app_private.sx_claim_snap_internal(p_message_id);
$$;
revoke all on function public.sx_claim_snap(uuid) from public, anon;
grant execute on function public.sx_claim_snap(uuid) to authenticated;

drop policy if exists sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id='snapshotx-media' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists (
      select 1 from public.sx_messages m where m.media_path=name
        and app_private.sx_is_member(m.thread_id)
        and m.expires_at>now()
        and (not m.view_once or exists (
          select 1 from public.sx_receipts r
          where r.message_id=m.id and r.user_id=auth.uid()
            and r.opened_at > now()-interval '90 seconds'
        ))
    )
    or exists (
      select 1 from public.sx_stories s where s.media_path=name
        and (s.owner_id=auth.uid() or (s.expires_at>now() and
          (s.visibility='everyone' or exists (
            select 1 from public.sx_friends f where f.user_id=auth.uid() and f.friend_id=s.owner_id
          ))))
    )
  )
);
