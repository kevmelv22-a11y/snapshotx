-- Snapchat "Peilingen" (polls) in group chats.
-- NOT APPLIED to any project yet (source file only). Requires 20261019120000_sx_data_api_grants_rls.sql
-- (app_private.sx_is_member). Same rules + Dutch errors as lib/chat-polls.ts (POLL_ERRORS) and the demo client.
--   * A poll is an ordinary kind='text' message whose body is '[poll]{"q":"…","o":["…", …]}' (2–5 answers), so
--     sx_messages needs no change and old clients just show the token.
--   * Votes: one row per (message, user) in public.sx_poll_votes. Members of the thread can read them; clients have
--     NO write grant — public.sx_vote_poll(p_message_id, p_option) is the only way to vote, switch or take a vote
--     back (p_option null). It checks membership, that the message is a live poll and that the answer exists.
--   * Unsending a poll (sx_unsend_message) turns it into a system line; its votes are deleted by the trigger below.

create table if not exists public.sx_poll_votes (
  message_id uuid not null references public.sx_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 4),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists sx_poll_votes_user_idx on public.sx_poll_votes (user_id);
alter table public.sx_poll_votes enable row level security;
revoke all on public.sx_poll_votes from public, anon, authenticated;
grant select on public.sx_poll_votes to authenticated;
drop policy if exists sx_poll_votes_read on public.sx_poll_votes;
create policy sx_poll_votes_read on public.sx_poll_votes for select to authenticated
  using (app_private.sx_is_member((select m.thread_id from public.sx_messages m where m.id = message_id)));

create or replace function public.sx_vote_poll(p_message_id uuid, p_option integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; poll jsonb; n integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into m from public.sx_messages where id = p_message_id;
  if not found or m.unsent_at is not null or m.kind <> 'text' or left(btrim(coalesce(m.body, '')), 6) <> '[poll]' then
    raise exception 'Dit bericht is geen peiling';
  end if;
  if not app_private.sx_is_member(m.thread_id) then raise exception 'Je zit niet (meer) in deze chat'; end if;
  begin
    poll := substr(btrim(m.body), 7)::jsonb;
  exception when others then
    raise exception 'Dit bericht is geen peiling';
  end;
  if jsonb_typeof(poll -> 'o') <> 'array' then raise exception 'Dit bericht is geen peiling'; end if;
  n := jsonb_array_length(poll -> 'o');
  if n < 2 or n > 5 then raise exception 'Dit bericht is geen peiling'; end if;
  if p_option is null then
    delete from public.sx_poll_votes where message_id = m.id and user_id = uid;
    return null;
  end if;
  if p_option < 0 or p_option >= n then raise exception 'Dit antwoord bestaat niet'; end if;
  insert into public.sx_poll_votes (message_id, user_id, option_index) values (m.id, uid, p_option)
    on conflict (message_id, user_id) do update set option_index = excluded.option_index, created_at = now();
  return p_option;
end $$;
revoke all on function public.sx_vote_poll(uuid, integer) from public, anon;
grant execute on function public.sx_vote_poll(uuid, integer) to authenticated;

-- Unsent poll → its votes go too (the message row itself stays as the grey "… heeft een chat verwijderd" line).
create or replace function app_private.sx_poll_votes_on_unsend() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.unsent_at is not null and old.unsent_at is null then delete from public.sx_poll_votes where message_id = new.id; end if;
  return new;
end $$;
revoke all on function app_private.sx_poll_votes_on_unsend() from public, anon, authenticated;
-- unsent_at comes from 20261027090000_chat_edit_unsend.sql; add it here too so this file also applies on its own.
alter table public.sx_messages add column if not exists unsent_at timestamptz;
drop trigger if exists sx_poll_votes_on_unsend on public.sx_messages;
create trigger sx_poll_votes_on_unsend after update of unsent_at on public.sx_messages
  for each row execute function app_private.sx_poll_votes_on_unsend();

do $$ begin
  alter publication supabase_realtime add table public.sx_poll_votes;
exception when duplicate_object or undefined_object then null;
end $$;
