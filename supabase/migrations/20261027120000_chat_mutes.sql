-- Snapchat "Berichtmeldingen" (Chatinstellingen → Alle meldingen / Stil): per-user, per-chat push mute.
-- NOT APPLIED to any project yet (source file only). Requires 20261019120000_sx_data_api_grants_rls.sql
-- (app_private.sx_is_member) and 20260926075332_user_blocking.sql (sx_push_recipients, redefined below).
-- Client: stores/chatFeed.ts keeps the mute device-local and mirrors it here best-effort (lib/chat-mute.ts muteRow):
--   muted_until null = "Stil tot ik het weer aanzet", otherwise silent until that moment.
-- Messages still arrive and show in the chat feed; only push notifications are skipped.

create table if not exists public.sx_thread_mutes (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.sx_threads(id) on delete cascade,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table public.sx_thread_mutes enable row level security;

drop policy if exists sx_thread_mutes_own_select on public.sx_thread_mutes;
create policy sx_thread_mutes_own_select on public.sx_thread_mutes for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists sx_thread_mutes_own_insert on public.sx_thread_mutes;
create policy sx_thread_mutes_own_insert on public.sx_thread_mutes for insert to authenticated
  with check (user_id = (select auth.uid()) and app_private.sx_is_member(thread_id));
drop policy if exists sx_thread_mutes_own_update on public.sx_thread_mutes;
create policy sx_thread_mutes_own_update on public.sx_thread_mutes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and app_private.sx_is_member(thread_id));
drop policy if exists sx_thread_mutes_own_delete on public.sx_thread_mutes;
create policy sx_thread_mutes_own_delete on public.sx_thread_mutes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.sx_thread_mutes from anon, public;
grant select, insert, update, delete on public.sx_thread_mutes to authenticated;
grant all on public.sx_thread_mutes to service_role;

-- Push resolution (server-only, used by supabase/functions/push-message): same as before, plus
-- recipients who silenced this chat (forever, or until a moment still in the future) are skipped.
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
      where d.message_id = p_message_id and d.user_id = m2.user_id)
    and not exists (select 1 from public.sx_thread_mutes mu
      where mu.user_id = m2.user_id and mu.thread_id = msg.thread_id
        and (mu.muted_until is null or mu.muted_until > now()));
$$;
