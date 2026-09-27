-- SnapShot X feature tables. Apply in Supabase SQL Editor once per project.
create schema if not exists app_private;
create table if not exists public.sx_friend_requests (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(), unique(sender_id,recipient_id), check(sender_id<>recipient_id)
);
create table if not exists public.sx_friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,friend_id), check(user_id<>friend_id)
);
create table if not exists public.sx_threads (
  id uuid primary key default gen_random_uuid(), title text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.sx_members (
  thread_id uuid not null references public.sx_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(), primary key(thread_id,user_id)
);
create table if not exists public.sx_messages (
  id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.sx_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id), kind text not null default 'text' check(kind in ('text','photo','video','voice','snap')),
  body text, media_path text, view_once boolean not null default false,
  expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.sx_receipts (
  message_id uuid not null references public.sx_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id), opened_at timestamptz,
  replay_count integer not null default 0 check(replay_count between 0 and 1),
  primary key(message_id,user_id)
);
create table if not exists public.sx_stories (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  media_path text not null, media_type text not null check(media_type in ('photo','video')),
  caption text, visibility text not null default 'friends' check(visibility in ('friends','everyone')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '24 hours')
);
create table if not exists public.sx_story_views (
  story_id uuid not null references public.sx_stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id), viewed_at timestamptz not null default now(),
  primary key(story_id,viewer_id)
);
create table if not exists public.sx_story_reactions (
  story_id uuid not null references public.sx_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id), emoji text not null,
  created_at timestamptz not null default now(), primary key(story_id,user_id)
);
create table if not exists public.sx_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'nl' check(language in ('nl','en')),
  ghost_mode boolean not null default true, notifications_enabled boolean not null default false,
  latitude double precision, longitude double precision,
  updated_at timestamptz not null default now(),
  check (ghost_mode or (latitude between -90 and 90 and longitude between -180 and 180))
);
create table if not exists public.sx_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null, updated_at timestamptz not null default now(), primary key(user_id,token)
);
create index if not exists sx_messages_thread_time on public.sx_messages(thread_id,created_at desc);
create index if not exists sx_stories_expiry on public.sx_stories(expires_at);
create index if not exists sx_requests_recipient on public.sx_friend_requests(recipient_id,status);

create or replace function app_private.sx_is_member(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sx_members m where m.thread_id=t and m.user_id=(select auth.uid()));
$$;
revoke all on function app_private.sx_is_member(uuid) from public,anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.sx_is_member(uuid) to authenticated;

create or replace function public.sx_accept_friend(request_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r public.sx_friend_requests;
begin
  select * into r from public.sx_friend_requests where id=request_id and recipient_id=auth.uid() and status='pending' for update;
  if not found then raise exception 'Friend request not found'; end if;
  update public.sx_friend_requests set status='accepted' where id=request_id;
  insert into public.sx_friends(user_id,friend_id) values (r.sender_id,r.recipient_id),(r.recipient_id,r.sender_id) on conflict do nothing;
end $$;
revoke all on function public.sx_accept_friend(uuid) from public,anon;
grant execute on function public.sx_accept_friend(uuid) to authenticated;

create or replace function public.sx_open_thread(participants uuid[], group_title text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid; uid uuid := auth.uid(); target uuid; peers uuid[];
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select array_agg(distinct p) into peers from unnest(participants) p where p <> uid;
 if peers is null or cardinality(peers)>20 then raise exception 'Choose 1 to 20 friends'; end if;
 foreach target in array peers loop
   if not exists(select 1 from public.sx_friends where user_id=uid and friend_id=target) then raise exception 'Only friends can be added'; end if;
 end loop;
 insert into public.sx_threads(title,created_by) values (left(group_title,80),uid) returning id into tid;
 insert into public.sx_members(thread_id,user_id) select tid,p from unnest(array_append(peers,uid)) p;
 return tid;
end $$;
revoke all on function public.sx_open_thread(uuid[],text) from public,anon;
grant execute on function public.sx_open_thread(uuid[],text) to authenticated;

alter table public.sx_friend_requests enable row level security;
alter table public.sx_friends enable row level security;
alter table public.sx_threads enable row level security;
alter table public.sx_members enable row level security;
alter table public.sx_messages enable row level security;
alter table public.sx_receipts enable row level security;
alter table public.sx_stories enable row level security;
alter table public.sx_story_views enable row level security;
alter table public.sx_story_reactions enable row level security;
alter table public.sx_preferences enable row level security;
alter table public.sx_push_tokens enable row level security;

grant select,insert on public.sx_friend_requests to authenticated;
grant select on public.sx_friends,public.sx_threads,public.sx_members to authenticated;
grant select,insert on public.sx_messages,public.sx_receipts,public.sx_story_views,public.sx_story_reactions to authenticated;
grant select,insert,update,delete on public.sx_stories to authenticated;
grant select,insert,update on public.sx_preferences,public.sx_push_tokens to authenticated;
grant delete on public.sx_push_tokens to authenticated;

create policy sx_requests_read on public.sx_friend_requests for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy sx_requests_send on public.sx_friend_requests for insert to authenticated with check (sender_id=auth.uid() and status='pending' and exists(select 1 from public.profiles where id=recipient_id));
create policy sx_friends_read on public.sx_friends for select to authenticated using (user_id=auth.uid());
create policy sx_threads_read on public.sx_threads for select to authenticated using (app_private.sx_is_member(id));
create policy sx_members_read on public.sx_members for select to authenticated using (app_private.sx_is_member(thread_id));
create policy sx_messages_read on public.sx_messages for select to authenticated using (app_private.sx_is_member(thread_id) and (expires_at is null or expires_at>now()));
create policy sx_messages_send on public.sx_messages for insert to authenticated with check (sender_id=auth.uid() and app_private.sx_is_member(thread_id) and (expires_at is null or expires_at<=now()+interval '24 hours') and (media_path is null or split_part(media_path,'/',1)=auth.uid()::text));
create policy sx_receipts_read on public.sx_receipts for select to authenticated using (app_private.sx_is_member((select thread_id from public.sx_messages where id=message_id)));
create policy sx_receipts_insert on public.sx_receipts for insert to authenticated with check (user_id=auth.uid() and replay_count=0 and app_private.sx_is_member((select thread_id from public.sx_messages where id=message_id)));
create policy sx_stories_read on public.sx_stories for select to authenticated using (owner_id=auth.uid() or (expires_at>now() and (visibility='everyone' or exists(select 1 from public.sx_friends where user_id=auth.uid() and friend_id=owner_id))));
create policy sx_stories_write on public.sx_stories for insert to authenticated with check (owner_id=auth.uid() and split_part(media_path,'/',1)=auth.uid()::text and expires_at<=now()+interval '24 hours');
create policy sx_stories_update on public.sx_stories for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy sx_stories_delete on public.sx_stories for delete to authenticated using (owner_id=auth.uid());
create policy sx_story_views_read on public.sx_story_views for select to authenticated using (viewer_id=auth.uid() or exists(select 1 from public.sx_stories s where s.id=story_id and s.owner_id=auth.uid()));
create policy sx_story_views_insert on public.sx_story_views for insert to authenticated with check (viewer_id=auth.uid() and exists(select 1 from public.sx_stories s where s.id=story_id));
create policy sx_story_reactions_read on public.sx_story_reactions for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.sx_stories s where s.id=story_id and s.owner_id=auth.uid()));
create policy sx_story_reactions_insert on public.sx_story_reactions for insert to authenticated with check (user_id=auth.uid() and char_length(emoji)<12 and exists(select 1 from public.sx_stories s where s.id=story_id));
create policy sx_preferences_self on public.sx_preferences for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy sx_push_self on public.sx_push_tokens for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('snapshotx-media','snapshotx-media',false,52428800,array['image/jpeg','image/png','video/mp4','audio/m4a','audio/mp4'])
on conflict(id) do nothing;
create policy sx_media_upload on storage.objects for insert to authenticated
with check (bucket_id='snapshotx-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy sx_media_read on storage.objects for select to authenticated using (
 bucket_id='snapshotx-media' and (
 (storage.foldername(name))[1]=auth.uid()::text
 or exists(select 1 from public.sx_messages m where m.media_path=name and app_private.sx_is_member(m.thread_id) and (m.expires_at is null or m.expires_at>now()))
 or exists(select 1 from public.sx_stories s where s.media_path=name and (s.owner_id=auth.uid() or (s.expires_at>now() and (s.visibility='everyone' or exists(select 1 from public.sx_friends f where f.user_id=auth.uid() and f.friend_id=s.owner_id)))))
 ));
create policy sx_media_delete on storage.objects for delete to authenticated using (bucket_id='snapshotx-media' and (storage.foldername(name))[1]=auth.uid()::text);

do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sx_messages') then
   alter publication supabase_realtime add table public.sx_messages;
 end if;
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sx_stories') then
   alter publication supabase_realtime add table public.sx_stories;
 end if;
end $$;
