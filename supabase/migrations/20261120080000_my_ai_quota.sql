-- Mijn AI: per-user daily message counter for the my-ai edge function (server only: no client access at all).
-- The conversation itself is never stored on the server.
create table if not exists public.sx_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'Europe/Amsterdam')::date),
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);
alter table public.sx_ai_usage enable row level security;
revoke all on public.sx_ai_usage from anon, authenticated;

-- Takes one message from today's quota; returns what is left (>= 0) or -1 when the limit is reached.
create or replace function public.sx_ai_take_quota(p_user uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'Europe/Amsterdam')::date; v_calls int;
begin
  if p_user is null or p_limit is null or p_limit < 1 then return -1; end if;
  insert into public.sx_ai_usage(user_id, day, calls) values (p_user, v_day, 1)
    on conflict (user_id, day) do update set calls = public.sx_ai_usage.calls + 1
    where public.sx_ai_usage.calls < p_limit
    returning calls into v_calls;
  if v_calls is null then return -1; end if;
  delete from public.sx_ai_usage where user_id = p_user and day < v_day - 7;
  return p_limit - v_calls;
end $$;
revoke all on function public.sx_ai_take_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.sx_ai_take_quota(uuid, integer) to service_role;
