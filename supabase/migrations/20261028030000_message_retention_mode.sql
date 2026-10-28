-- Snapchat "Chats verwijderen": a new setting only applies to chats sent from then on.
-- NOT APPLIED to any project yet — review and run it yourself. Requires 20261013150000_chat_step4.sql
-- (sx_threads.retention_mode, sx_apply_retention), 20261022150000_chat_saves.sql (sx_set_message_saved) and
-- 20261019120000_sx_data_api_grants_rls.sql (app_private.sx_is_member).
--
-- Snapchat support: "Messages sent after retention is changed will reflect the new settings, but older messages will
-- still reflect the settings from when they were originally sent." Before this migration the expiry was decided by the
-- thread's mode at VIEW time while the app judged every message by the CURRENT mode, so after switching a chat to
-- "Bewaren" chats that already had a 24 h timer still vanished (server) although the app showed them as kept, and
-- switching away from "Bewaren" made the app hide old kept chats. Now every message carries the mode it was sent with.
-- App/demo mirror: lib/chat-retention.ts (sentModes / isVisibleAsSent) + lib/demo-client.ts stampRetention().

-- 1. The mode a message was sent with (system lines: null).
alter table public.sx_messages add column if not exists retention_mode text
  check (retention_mode is null or retention_mode in ('after_view','24h','keep'));
comment on column public.sx_messages.retention_mode is 'Chats verwijderen mode of the thread when this message was sent; decides its expiry (Snapchat: new settings apply going forward).';

-- 2. Backfill: messages that already got a deletion time while the chat is now on keep were sent/viewed under a timer.
update public.sx_messages m
   set retention_mode = case when m.expires_at is not null and not coalesce(m.saved, false) and t.retention_mode = 'keep' then '24h' else t.retention_mode end
  from public.sx_threads t
 where t.id = m.thread_id and m.kind <> 'system' and m.retention_mode is null;

-- 3. Stamp every new message server-side (clients cannot choose): thread mode now; keep → no expiry (snaps keep their own).
create or replace function app_private.sx_stamp_retention() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'system' then new.retention_mode := null; return new; end if;
  select t.retention_mode into new.retention_mode from public.sx_threads t where t.id = new.thread_id;
  new.retention_mode := coalesce(new.retention_mode, '24h');
  if new.retention_mode = 'keep' and new.kind <> 'snap' then new.expires_at := null; end if;
  return new;
end $$;
revoke all on function app_private.sx_stamp_retention() from public, anon, authenticated;
drop trigger if exists sx_messages_stamp_retention on public.sx_messages;
create trigger sx_messages_stamp_retention before insert on public.sx_messages
  for each row execute function app_private.sx_stamp_retention();

-- 4. Viewing applies the message's own mode (was: the thread's mode at view time).
create or replace function app_private.sx_apply_retention() returns trigger language plpgsql security definer set search_path = '' as $$
declare m record; mode text; pending int;
begin
  if new.opened_at is null then return new; end if;
  select msg.id, msg.thread_id, msg.sender_id, msg.kind, msg.saved, msg.retention_mode into m from public.sx_messages msg where msg.id = new.message_id;
  if m.kind in ('snap','system') or coalesce(m.saved, false) then return new; end if;
  mode := m.retention_mode;
  if mode is null then select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id; end if;
  if mode = 'keep' then
    update public.sx_messages set expires_at = null where id = m.id;
  elsif mode = '24h' then
    update public.sx_messages set expires_at = greatest(coalesce(expires_at, now()), new.opened_at + interval '24 hours') where id = m.id;
  else -- after_view: once every other member has opened it
    select count(*) into pending from public.sx_members mem
      where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
        and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null);
    if pending = 0 then update public.sx_messages set expires_at = now() + interval '10 minutes' where id = m.id; end if;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_apply_retention() from public, anon, authenticated;

-- 5. Unsave ("Niet meer opslaan") re-applies the message's own mode. Otherwise identical to 20261022150000_chat_saves.sql.
create or replace function public.sx_set_message_saved(p_message_id uuid, p_saved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; mode text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into m from public.sx_messages where id = p_message_id for update;
  if not found then raise exception 'Dit bericht bestaat niet meer'; end if;
  if not app_private.sx_is_member(m.thread_id) then raise exception 'Je zit niet (meer) in deze chat'; end if;
  if m.kind not in ('text', 'photo', 'video', 'voice') then raise exception 'Snaps en meldingen kun je niet opslaan in de chat'; end if;
  if p_saved then
    if not m.saved then
      update public.sx_messages set saved = true, saved_by = uid, saved_at = now(), expires_at = null where id = m.id;
    end if;
    return true;
  end if;
  if not m.saved then return false; end if;
  if m.saved_by is not null and m.saved_by <> uid and m.sender_id <> uid then
    raise exception 'Alleen wie het bericht opsloeg of verstuurde kan het opslaan ongedaan maken';
  end if;
  -- Unsaving re-applies the setting the message was SENT with (Snapchat), not the chat's current one.
  mode := m.retention_mode;
  if mode is null then select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id; end if;
  update public.sx_messages
     set saved = false, saved_by = null, saved_at = null,
         expires_at = case when coalesce(mode, '24h') = 'keep' then null else now() + interval '24 hours' end
   where id = m.id;
  return false;
end $$;
revoke all on function public.sx_set_message_saved(uuid, boolean) from public, anon;
grant execute on function public.sx_set_message_saved(uuid, boolean) to authenticated;
