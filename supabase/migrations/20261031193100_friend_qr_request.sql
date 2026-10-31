-- QR / link friend adding (2026-10-31). Idempotent; adds two RPCs, changes no RLS, deletes no data.
--   * sx_lookup_friend_code(p_username, p_user_id): resolve a scanned code / snapshot-x.nl/add/<username> link to a
--     profile plus the caller's relation to it (self / friends / incoming / outgoing / none). Blocked pairs look "not found".
--   * sx_request_friend(p_user_id): one call for "Toevoegen" from a scanned code:
--       - already friends            -> 'friends'
--       - they already asked me      -> accept it (both sx_friends rows) -> 'accepted'
--       - otherwise                  -> my request becomes pending (a previously declined one is re-opened) -> 'pending'
--     Rejects self, unknown, blocked, banned and unauthenticated callers.

create or replace function public.sx_lookup_friend_code(p_username text default null, p_user_id uuid default null)
returns table(id uuid, username text, display_name text, avatar_path text, relation text, request_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_uid uuid := (select auth.uid()); v_target uuid; v_u text := lower(trim(coalesce(p_username,'')));
begin
  if v_uid is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_user_id is not null then select p.id into v_target from public.profiles p where p.id=p_user_id;
  elsif v_u ~ '^[a-z0-9_.]{3,30}$' then select p.id into v_target from public.profiles p where lower(p.username)=v_u;
  end if;
  if v_target is null or (v_target<>v_uid and app_private.sx_blocked_with(v_target)) then return; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_path,
      case when p.id=v_uid then 'self'
           when exists(select 1 from public.sx_friends f where f.user_id=v_uid and f.friend_id=p.id) then 'friends'
           when exists(select 1 from public.sx_friend_requests r where r.sender_id=p.id and r.recipient_id=v_uid and r.status='pending') then 'incoming'
           when exists(select 1 from public.sx_friend_requests r where r.sender_id=v_uid and r.recipient_id=p.id and r.status='pending') then 'outgoing'
           else 'none' end,
      (select r.id from public.sx_friend_requests r where r.sender_id=p.id and r.recipient_id=v_uid and r.status='pending')
    from public.profiles p where p.id=v_target;
end $$;
revoke all on function public.sx_lookup_friend_code(text,uuid) from public, anon;
grant execute on function public.sx_lookup_friend_code(text,uuid) to authenticated;

create or replace function public.sx_request_friend(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_in public.sx_friend_requests;
begin
  if v_uid is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=v_uid then raise exception 'invalid target user'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) or app_private.sx_blocked_with(p_user_id) then raise exception 'user not found'; end if;
  -- Serialize per pair so two people scanning each other at once end up friends, not with two pending rows.
  perform pg_advisory_xact_lock(hashtext('snapshotx.friend.' || least(v_uid,p_user_id)::text || greatest(v_uid,p_user_id)::text));
  if exists(select 1 from public.sx_friends where user_id=v_uid and friend_id=p_user_id) then return 'friends'; end if;
  select * into v_in from public.sx_friend_requests where sender_id=p_user_id and recipient_id=v_uid and status='pending' for update;
  if found then
    update public.sx_friend_requests set status='accepted' where id=v_in.id;
    insert into public.sx_friends(user_id,friend_id) values (v_uid,p_user_id),(p_user_id,v_uid) on conflict do nothing;
    return 'accepted';
  end if;
  insert into public.sx_friend_requests(sender_id,recipient_id,status) values (v_uid,p_user_id,'pending')
  on conflict (sender_id,recipient_id) do update set status='pending', created_at=now()
    where public.sx_friend_requests.status='declined'
       or (public.sx_friend_requests.status='accepted' and not exists(select 1 from public.sx_friends f where f.user_id=v_uid and f.friend_id=p_user_id));
  return 'pending';
end $$;
revoke all on function public.sx_request_friend(uuid) from public, anon;
grant execute on function public.sx_request_friend(uuid) to authenticated;
