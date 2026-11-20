-- Vriend-emoji's that need the other side (Snapchat 😁 / 😏 / 😬): for each of MY friends, am I one of THEIR best
-- friends (rank 1..8), and is their #1 the same person as my #1? Same scoring as lib/friend-emojis.ts (1-on-1 chats,
-- last 7 days, snap = 2, other non-system messages = 1, both sides must have sent something, score >= 4, top 8,
-- ties: newest interaction first, then id). Only returns facts about ME in their ranking + one boolean; never who else
-- is in a friend's list. Blocked pairs are skipped. Read-only, security definer because it reads other people's chats.
create or replace function public.sx_friend_ranks()
returns table(friend_id uuid, their_rank integer, same_number_one boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Sign in required'; end if;
  return query
  with fr as (
    select f.friend_id as id from public.sx_friends f
    where f.user_id = uid and not exists (select 1 from public.sx_blocks b where (b.blocker_id = uid and b.blocked_id = f.friend_id) or (b.blocker_id = f.friend_id and b.blocked_id = uid))
  ), people as (select id from fr union select uid),
  direct as (
    select m1.user_id as a, m2.user_id as b, t.id as thread_id
    from public.sx_threads t
    join public.sx_members m1 on m1.thread_id = t.id
    join public.sx_members m2 on m2.thread_id = t.id and m2.user_id <> m1.user_id
    where t.title is null and m1.user_id in (select id from people)
      and (select count(*) from public.sx_members x where x.thread_id = t.id) = 2
  ), ev as (
    select d.a, d.b, sum(case when m.kind = 'snap' then 2 else 1 end)::int as score,
      bool_or(m.sender_id = d.a) as a_sent, bool_or(m.sender_id = d.b) as b_sent, max(m.created_at) as last_at
    from direct d join public.sx_messages m on m.thread_id = d.thread_id
    where m.created_at > now() - interval '7 days' and m.kind <> 'system' and m.sender_id in (d.a, d.b)
    group by d.a, d.b
  ), ranked as (
    select e.a, e.b, row_number() over (partition by e.a order by e.score desc, e.last_at desc, e.b::text)::int as rn
    from ev e where e.a_sent and e.b_sent and e.score >= 4
  ), tops as (select r.a, r.b from ranked r where r.rn = 1)
  select fr.id,
    (select r.rn from ranked r where r.a = fr.id and r.b = uid and r.rn <= 8),
    coalesce((select t1.b from tops t1 where t1.a = fr.id) = (select t2.b from tops t2 where t2.a = uid) and (select t2.b from tops t2 where t2.a = uid) <> fr.id, false)
  from fr;
end $$;
revoke all on function public.sx_friend_ranks() from public, anon;
grant execute on function public.sx_friend_ranks() to authenticated;
