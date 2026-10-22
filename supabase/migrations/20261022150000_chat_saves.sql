-- Snapchat "Opslaan in chat": a chat member saves/unsaves a message; saved messages never disappear.
-- NOT APPLIED to any project yet (source file only). Requires 20261013190200_disappear_cleanup.sql (sx_messages.saved,
-- cleanup skips saved rows), 20261013150000_chat_step4.sql (sx_threads.retention_mode) and
-- 20261019120000_sx_data_api_grants_rls.sql (app_private.sx_is_member; clients have no UPDATE on sx_messages).
-- Same rules + Dutch errors as lib/chat-saves.ts (SAVE_ERRORS) and the demo client:
--   * text / photo / video / voice only (no one-time snaps, no system lines);
--   * any member may save; only the saver, the original sender, or anyone for legacy rows without saved_by may unsave;
--   * unsaving re-applies the thread setting: keep → never expires, otherwise 24 h from now.

alter table public.sx_messages add column if not exists saved_by uuid references auth.users(id) on delete set null;
alter table public.sx_messages add column if not exists saved_at timestamptz;

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
  select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id;
  update public.sx_messages
     set saved = false, saved_by = null, saved_at = null,
         expires_at = case when coalesce(mode, '24h') = 'keep' then null else now() + interval '24 hours' end
   where id = m.id;
  return false;
end $$;
revoke all on function public.sx_set_message_saved(uuid, boolean) from public, anon;
grant execute on function public.sx_set_message_saved(uuid, boolean) to authenticated;
