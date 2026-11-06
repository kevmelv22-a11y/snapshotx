-- Vriendschap beëindigen: delete both sx_friends rows + own nickname for that friend.
-- Clients have no DELETE grant on sx_friends (select-only), so this SECURITY DEFINER RPC is the only way.

create or replace function public.sx_unfriend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_friend_id is null or p_friend_id = v_uid then
    raise exception 'invalid friend';
  end if;
  if not exists (
    select 1 from public.sx_friends f
    where f.user_id = v_uid and f.friend_id = p_friend_id
  ) then
    raise exception 'Not friends';
  end if;

  delete from public.sx_friends
  where (user_id = v_uid and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = v_uid);

  -- Drop my nickname for them (table may be absent on older DBs).
  if to_regclass('public.sx_friend_nicknames') is not null then
    delete from public.sx_friend_nicknames
    where owner_id = v_uid and friend_id = p_friend_id;
  end if;
end;
$$;

revoke all on function public.sx_unfriend(uuid) from public, anon;
grant execute on function public.sx_unfriend(uuid) to authenticated;
