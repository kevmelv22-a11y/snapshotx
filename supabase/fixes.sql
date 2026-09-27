-- Follow-up migration for receipt updates and stable one-to-one threads.
grant update on public.sx_receipts,public.sx_story_views,public.sx_story_reactions to authenticated;
create policy sx_receipts_update on public.sx_receipts for update to authenticated
using (user_id=auth.uid() and app_private.sx_is_member((select thread_id from public.sx_messages where id=message_id)))
with check (user_id=auth.uid() and replay_count<=1);
create policy sx_story_views_update on public.sx_story_views for update to authenticated
using (viewer_id=auth.uid()) with check (viewer_id=auth.uid());
create policy sx_story_reactions_update on public.sx_story_reactions for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.sx_open_thread(participants uuid[], group_title text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid := auth.uid(); target uuid; peers uuid[];
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select array_agg(distinct p) into peers from unnest(participants) p where p <> uid;
 if peers is null or cardinality(peers)>20 then raise exception 'Choose 1 to 20 friends'; end if;
 foreach target in array peers loop
   if not exists(select 1 from public.sx_friends where user_id=uid and friend_id=target) then raise exception 'Only friends can be added'; end if;
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
revoke all on function public.sx_open_thread(uuid[],text) from public,anon;
grant execute on function public.sx_open_thread(uuid[],text) to authenticated;
revoke all on public.sx_friend_requests,public.sx_friends,public.sx_threads,public.sx_members,public.sx_messages,public.sx_receipts,public.sx_stories,public.sx_story_views,public.sx_story_reactions,public.sx_preferences,public.sx_push_tokens from public,anon;
create table if not exists public.sx_push_deliveries(message_id uuid primary key references public.sx_messages(id) on delete cascade,sent_at timestamptz not null default now());
alter table public.sx_push_deliveries enable row level security;
revoke all on public.sx_push_deliveries from public,anon,authenticated;
