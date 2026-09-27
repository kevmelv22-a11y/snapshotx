-- Applied to the live project with explicit approval on 2026-09-26.
-- Supabase recorded the remote migration as 20260926080328_user_blocking.
-- A block is symmetric for interactions, but only its creator can list/remove it.
create table public.sx_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index sx_blocks_blocked on public.sx_blocks(blocked_id, blocker_id);
alter table public.sx_blocks enable row level security;
revoke all on public.sx_blocks from public, anon, authenticated;
grant select, insert (blocker_id, blocked_id), delete on public.sx_blocks to authenticated;
create policy sx_blocks_own_read on public.sx_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy sx_blocks_own_insert on public.sx_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy sx_blocks_own_delete on public.sx_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- The private helper avoids recursive RLS when another table's policy checks a block.
create function app_private.sx_blocked_with(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.sx_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other)
       or (b.blocked_id = (select auth.uid()) and b.blocker_id = p_other)
  );
$$;
revoke all on function app_private.sx_blocked_with(uuid) from public, anon;
grant execute on function app_private.sx_blocked_with(uuid) to authenticated;

drop policy sx_requests_read on public.sx_friend_requests;
create policy sx_requests_read on public.sx_friend_requests for select to authenticated
  using ((sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
    and not app_private.sx_blocked_with(
      case when sender_id = (select auth.uid()) then recipient_id else sender_id end));
drop policy sx_requests_send on public.sx_friend_requests;
create policy sx_requests_send on public.sx_friend_requests for insert to authenticated
  with check (sender_id = (select auth.uid()) and status = 'pending'
    and not app_private.sx_blocked_with(recipient_id)
    and exists (select 1 from public.profiles where id = recipient_id));
drop policy sx_friends_read on public.sx_friends;
create policy sx_friends_read on public.sx_friends for select to authenticated
  using (user_id = (select auth.uid()) and not app_private.sx_blocked_with(friend_id));

create or replace function public.sx_accept_friend(request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.sx_friend_requests;
begin
  select * into r from public.sx_friend_requests
    where id = request_id and recipient_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Friend request not found'; end if;
  if exists (select 1 from public.sx_blocks b
    where (b.blocker_id = r.sender_id and b.blocked_id = r.recipient_id)
       or (b.blocker_id = r.recipient_id and b.blocked_id = r.sender_id)) then
    raise exception 'Interaction blocked';
  end if;
  update public.sx_friend_requests set status = 'accepted' where id = request_id;
  insert into public.sx_friends(user_id,friend_id)
    values (r.sender_id,r.recipient_id),(r.recipient_id,r.sender_id) on conflict do nothing;
end $$;

create or replace function public.sx_open_thread(participants uuid[], group_title text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid := auth.uid(); target uuid; peers uuid[];
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select array_agg(distinct p) into peers from unnest(participants) p where p <> uid;
  if peers is null or cardinality(peers)>20 then raise exception 'Choose 1 to 20 friends'; end if;
  foreach target in array peers loop
    if not exists(select 1 from public.sx_friends where user_id=uid and friend_id=target)
       or exists(select 1 from public.sx_blocks b
         where (b.blocker_id=uid and b.blocked_id=target)
            or (b.blocker_id=target and b.blocked_id=uid)) then
      raise exception 'Only unblocked friends can be added';
    end if;
  end loop;
  if cardinality(peers)=1 and group_title is null then
    select t.id into tid from public.sx_threads t
    where t.title is null and
      (select count(*) from public.sx_members m where m.thread_id=t.id)=2 and
      exists(select 1 from public.sx_members m where m.thread_id=t.id and m.user_id=uid) and
      exists(select 1 from public.sx_members m where m.thread_id=t.id and m.user_id=peers[1])
    order by t.created_at limit 1;
    if tid is not null then return tid; end if;
  end if;
  insert into public.sx_threads(title,created_by) values (left(group_title,80),uid) returning id into tid;
  insert into public.sx_members(thread_id,user_id) select tid,p from unnest(array_append(peers,uid)) p;
  return tid;
end $$;

drop policy sx_messages_read on public.sx_messages;
create policy sx_messages_read on public.sx_messages for select to authenticated
  using (app_private.sx_is_member(thread_id) and not app_private.sx_blocked_with(sender_id)
    and (expires_at is null or expires_at > now()));
drop policy sx_messages_send on public.sx_messages;
create policy sx_messages_send on public.sx_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and app_private.sx_is_member(thread_id)
    and not exists (select 1 from public.sx_members member
      where member.thread_id = sx_messages.thread_id and member.user_id <> (select auth.uid())
        and app_private.sx_blocked_with(member.user_id))
    and (expires_at is null or expires_at <= now() + interval '24 hours')
    and (media_path is null or split_part(media_path,'/',1) = (select auth.uid())::text));
drop policy sx_stories_read on public.sx_stories;
create policy sx_stories_read on public.sx_stories for select to authenticated
  using (not app_private.sx_blocked_with(owner_id) and
    (owner_id = (select auth.uid()) or (expires_at > now() and
      (visibility = 'everyone' or exists (select 1 from public.sx_friends
        where user_id = (select auth.uid()) and friend_id = owner_id)))));

-- Private Storage access must agree with the new message/story visibility rules.
drop policy sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id = 'snapshotx-media' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.sx_messages m where m.media_path = name
      and app_private.sx_is_member(m.thread_id)
      and not app_private.sx_blocked_with(m.sender_id) and m.expires_at > now()
      and (not m.view_once or exists (select 1 from public.sx_receipts r
        where r.message_id = m.id and r.user_id = (select auth.uid())
          and r.opened_at > now() - interval '90 seconds')))
    or exists (select 1 from public.sx_stories s where s.media_path = name
      and not app_private.sx_blocked_with(s.owner_id)
      and (s.owner_id = (select auth.uid()) or (s.expires_at > now()
        and (s.visibility = 'everyone' or exists (select 1 from public.sx_friends f
          where f.user_id = (select auth.uid()) and f.friend_id = s.owner_id)))))
  )
);

-- Server-only push resolution must also exclude either direction of block.
create or replace function public.sx_push_recipients(p_message_id uuid)
returns table(user_id uuid, expo_token text, sender_name text, kind text, view_once boolean)
language sql stable security invoker set search_path = '' as $$
  select m2.user_id, t.token, p.display_name, msg.kind, msg.view_once
  from public.sx_messages msg
  join public.sx_members m2 on m2.thread_id = msg.thread_id and m2.user_id <> msg.sender_id
  join public.sx_push_tokens t on t.user_id = m2.user_id
  join public.profiles p on p.id = msg.sender_id
  where msg.id = p_message_id
    and not exists (select 1 from public.sx_blocks b
      where (b.blocker_id = msg.sender_id and b.blocked_id = m2.user_id)
         or (b.blocker_id = m2.user_id and b.blocked_id = msg.sender_id))
    and not exists (select 1 from public.sx_push_recipient_deliveries d
      where d.message_id = p_message_id and d.user_id = m2.user_id);
$$;
