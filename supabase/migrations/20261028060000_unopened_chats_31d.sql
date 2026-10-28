-- Snapchat: unopened chats are kept for 31 days (not 24 h).
-- NOT APPLIED to any project yet — review and run it yourself. Requires 20261028030000_message_retention_mode.sql
-- (sx_messages.retention_mode, sx_stamp_retention, sx_apply_retention, sx_set_message_saved) and
-- 20261013190200_disappear_cleanup.sql (sx_disappear_cleanup deletes chats whose expires_at has passed).
--
-- Snapchat support: "Chats are automatically deleted by default 24 hours after everyone in the conversation has viewed
-- the Chat … or 31 days after the Chat was sent, whichever is sooner."
-- Before this migration:
--   * Forwarded chats (sx_forward_message) and unsaved chats (sx_set_message_saved false) got expires_at = now() + 24 h
--     even when nobody had opened them → an unopened chat vanished after one day.
--   * Normal unopened chats had expires_at NULL → never deleted at all.
--   * "24 uur na bekijken" started at the FIRST viewer (greatest(...)), so in a group a chat could vanish before the
--     others had seen it.
-- Now: every non-kept chat (not snaps, not system lines, not saved) carries a 31-day cap from sending; once every other
-- member opened it the 24 h (or Na bekijken: 10 min) timer starts, never later than that cap.
-- App/demo mirror: lib/chat-features.ts (UNOPENED_CHAT_TTL_MS, messageExpiry createdAt cap), lib/backend/disappear.ts,
-- lib/chat-forward.ts forwardExpiry, lib/chat-saves.ts unsaveExpiry, lib/demo-client.ts stampRetention.

-- 1. Stamp: thread mode now; keep → no expiry; anything else → 31 days after sending (clients cannot choose).
create or replace function app_private.sx_stamp_retention() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'system' then new.retention_mode := null; return new; end if;
  select t.retention_mode into new.retention_mode from public.sx_threads t where t.id = new.thread_id;
  new.retention_mode := coalesce(new.retention_mode, '24h');
  if new.kind <> 'snap' and not coalesce(new.saved, false) then
    if new.retention_mode = 'keep' then new.expires_at := null;
    else new.expires_at := coalesce(new.created_at, now()) + interval '31 days';
    end if;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_stamp_retention() from public, anon, authenticated;
-- (trigger sx_messages_stamp_retention from 20261028030000 keeps pointing at this function)

-- 2. Viewing: the timer starts once EVERY other member opened the chat, capped at 31 days after sending.
create or replace function app_private.sx_apply_retention() returns trigger language plpgsql security definer set search_path = '' as $$
declare m record; mode text; pending int; cap timestamptz;
begin
  if new.opened_at is null then return new; end if;
  select msg.id, msg.thread_id, msg.sender_id, msg.kind, msg.saved, msg.retention_mode, msg.created_at into m
    from public.sx_messages msg where msg.id = new.message_id;
  if m.kind in ('snap','system') or coalesce(m.saved, false) then return new; end if;
  mode := m.retention_mode;
  if mode is null then select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id; end if;
  if mode = 'keep' then
    update public.sx_messages set expires_at = null where id = m.id;
    return new;
  end if;
  cap := m.created_at + interval '31 days';
  select count(*) into pending from public.sx_members mem
    where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
      and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null);
  if pending > 0 then
    update public.sx_messages set expires_at = cap where id = m.id;
  elsif mode = '24h' then
    update public.sx_messages set expires_at = least(cap, new.opened_at + interval '24 hours') where id = m.id;
  else -- after_view
    update public.sx_messages set expires_at = least(cap, now() + interval '10 minutes') where id = m.id;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_apply_retention() from public, anon, authenticated;

-- 3. Unsave ("Niet meer opslaan"): not opened by everyone yet → back to the 31-day cap; otherwise 24 h from now
--    (never past the cap). Otherwise identical to 20261028030000_message_retention_mode.sql.
create or replace function public.sx_set_message_saved(p_message_id uuid, p_saved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; mode text; pending int; cap timestamptz;
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
  mode := m.retention_mode;
  if mode is null then select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id; end if;
  cap := m.created_at + interval '31 days';
  select count(*) into pending from public.sx_members mem
    where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
      and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null);
  update public.sx_messages
     set saved = false, saved_by = null, saved_at = null,
         expires_at = case when coalesce(mode, '24h') = 'keep' then null
                           when pending > 0 then cap
                           else least(cap, now() + interval '24 hours') end
   where id = m.id;
  return false;
end $$;
revoke all on function public.sx_set_message_saved(uuid, boolean) from public, anon;
grant execute on function public.sx_set_message_saved(uuid, boolean) to authenticated;

-- 4. Backfill existing non-kept, unsaved chats that not every other member has opened yet: 31 days after sending
--    (fixes forwarded/unsaved chats stuck on a 24 h timer and unopened chats that never expired).
update public.sx_messages m
   set expires_at = m.created_at + interval '31 days'
 where m.kind not in ('snap', 'system') and not coalesce(m.saved, false)
   and coalesce(m.retention_mode, '24h') <> 'keep'
   and exists (select 1 from public.sx_members mem
                where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
                  and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null));
