-- Shared device: when a new account registers this phone's Expo token, the previous account's row for the SAME token
-- must go (RLS only lets a user delete their own rows, so the old account kept getting pushes on this phone).
create or replace function public.sx_claim_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;
  delete from public.sx_push_tokens where token = p_token and user_id <> uid;
  insert into public.sx_push_tokens (user_id, token, updated_at) values (uid, p_token, now())
    on conflict (user_id, token) do update set updated_at = excluded.updated_at;
end $$;
revoke all on function public.sx_claim_push_token(text) from public, anon;
grant execute on function public.sx_claim_push_token(text) to authenticated;
