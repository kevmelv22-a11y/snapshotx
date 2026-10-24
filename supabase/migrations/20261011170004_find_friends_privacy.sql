-- Privacy-safe friend suggestions. Source only: review against a read-only
-- schema dump before applying to any hosted project.
begin;

alter table public.sx_preferences
  add column if not exists find_me boolean not null default true;

create table if not exists public.sx_hidden_suggestions (
  user_id uuid not null references auth.users(id) on delete cascade,
  other_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, other_id),
  check (user_id <> other_id)
);

alter table public.sx_hidden_suggestions enable row level security;
revoke all on public.sx_hidden_suggestions from public, anon, authenticated;
grant select, insert (user_id, other_id) on public.sx_hidden_suggestions to authenticated;

drop policy if exists sx_hidden_suggestions_own_read on public.sx_hidden_suggestions;
create policy sx_hidden_suggestions_own_read
  on public.sx_hidden_suggestions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sx_hidden_suggestions_own_insert on public.sx_hidden_suggestions;
create policy sx_hidden_suggestions_own_insert
  on public.sx_hidden_suggestions for insert to authenticated
  with check ((select auth.uid()) = user_id and other_id <> (select auth.uid()));

create or replace function public.sx_suggest_friends(p_limit integer default 20)
returns table(user_id uuid, username text, display_name text, mutuals integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := coalesce(p_limit, 20);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_limit < 1 or v_limit > 30 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  return query
  with my_friends as (
    select f.friend_id
    from public.sx_friends f
    where f.user_id = v_uid
  ), candidates as (
    select f.friend_id as candidate_id, count(distinct mf.friend_id)::integer as mutual_count
    from my_friends mf
    join public.sx_friends f on f.user_id = mf.friend_id
    group by f.friend_id
  )
  select p.id, p.username, p.display_name, c.mutual_count
  from candidates c
  join public.profiles p on p.id = c.candidate_id
  left join public.sx_preferences pref on pref.user_id = p.id
  where c.candidate_id <> v_uid
    and coalesce(pref.find_me, true)
    and not exists (
      select 1 from my_friends mf where mf.friend_id = c.candidate_id
    )
    and not exists (
      select 1 from public.sx_blocks b
      where (b.blocker_id = v_uid and b.blocked_id = c.candidate_id)
         or (b.blocker_id = c.candidate_id and b.blocked_id = v_uid)
    )
    and not exists (
      select 1 from public.sx_friend_requests r
      where r.status = 'pending'
        and ((r.sender_id = v_uid and r.recipient_id = c.candidate_id)
          or (r.sender_id = c.candidate_id and r.recipient_id = v_uid))
    )
    and not exists (
      select 1 from public.sx_hidden_suggestions h
      where h.user_id = v_uid and h.other_id = c.candidate_id
    )
  order by c.mutual_count desc, p.username, p.id
  limit v_limit;
end;
$$;

revoke all on function public.sx_suggest_friends(integer) from public, anon, authenticated;
grant execute on function public.sx_suggest_friends(integer) to authenticated;

create or replace function public.sx_hide_suggestion(p_other_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_other_id is null or p_other_id = v_uid then
    raise exception 'invalid_user' using errcode = '22023';
  end if;
  insert into public.sx_hidden_suggestions(user_id, other_id)
  values (v_uid, p_other_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.sx_hide_suggestion(uuid) from public, anon, authenticated;
grant execute on function public.sx_hide_suggestion(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
