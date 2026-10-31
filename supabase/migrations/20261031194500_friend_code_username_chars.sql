-- Friend codes / snapshot-x.nl/add/<username>: accept every valid username char (letters, digits, . _ -), e.g. kv.savage.
create or replace function public.sx_lookup_friend_code(p_username text default null, p_user_id uuid default null)
returns table(id uuid, username text, display_name text, avatar_path text, relation text, request_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_uid uuid := (select auth.uid()); v_target uuid; v_u text := lower(trim(leading '@' from trim(coalesce(p_username,''))));
begin
  if v_uid is null or app_private.sx_request_is_banned() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_user_id is not null then select p.id into v_target from public.profiles p where p.id=p_user_id;
  elsif v_u ~ '^[a-z0-9_.-]{3,30}$' then select p.id into v_target from public.profiles p where lower(p.username)=v_u;
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
