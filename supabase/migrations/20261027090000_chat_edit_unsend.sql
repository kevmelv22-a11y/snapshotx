-- Snapchat "Bewerken" + "Verwijderen" for chat messages.
-- NOT APPLIED to any project yet (source file only). Requires 20261013150000_chat_step4.sql (kind 'system' +
-- sx_messages_system_no_media, sx_reactions) and 20261019120000_sx_data_api_grants_rls.sql (app_private.sx_is_member;
-- clients have no UPDATE on sx_messages, so these RPCs are the only way to change a message).
-- Same rules + Dutch errors as lib/chat-edits.ts (EDIT_ERRORS) and the demo client:
--   * Bewerken: only the sender, only text messages (no avatar stickers), only within 5 minutes of sending,
--     1..2000 characters after trimming; a quoted-reply prefix "[reply:…]\n" is kept; sets edited_at.
--   * Verwijderen: only the sender, any kind except system lines (also snaps / media / saved messages). The row becomes
--     Snapchat's grey line "<voornaam> heeft een chat verwijderd" (kind 'system', body replaced, media_path cleared,
--     unsaved, reactions removed) so the content is gone for every member. NOTE: an uploaded media object stays in the
--     storage bucket until the normal media cleanup removes unreferenced files.

alter table public.sx_messages add column if not exists edited_at timestamptz;
alter table public.sx_messages add column if not exists unsent_at timestamptz;

create or replace function public.sx_edit_message(p_message_id uuid, p_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; t text := btrim(coalesce(p_text, '')); visible text; prefix text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into m from public.sx_messages where id = p_message_id for update;
  if not found or m.unsent_at is not null then raise exception 'Dit bericht bestaat niet meer'; end if;
  if m.sender_id <> uid or not app_private.sx_is_member(m.thread_id) then raise exception 'Je kunt alleen je eigen berichten bewerken of verwijderen'; end if;
  -- Visible text = body without the quoted-reply prefix.
  prefix := coalesce(substring(m.body from '^(\[reply:[0-9A-Za-z-]{1,64}\|[0-9A-Za-z-]{1,64}\|(?:text|photo|video|voice|snap|sticker)\|[^\]\n]*\]\n)'), '');
  visible := substr(coalesce(m.body, ''), length(prefix) + 1);
  if m.kind <> 'text' or btrim(visible) ~ '^\[avatar-sticker:' then raise exception 'Alleen tekstberichten kun je bewerken'; end if;
  if now() - m.created_at >= interval '5 minutes' then raise exception 'Berichten kun je tot 5 minuten na het versturen bewerken'; end if;
  if t = '' then raise exception 'Een bericht kan niet leeg zijn'; end if;
  if char_length(t) > 2000 then raise exception 'Dit bericht is te lang (max. 2000 tekens)'; end if;
  if btrim(visible) = t then return false; end if;
  update public.sx_messages set body = prefix || t, edited_at = now() where id = m.id;
  return true;
end $$;

create or replace function public.sx_unsend_message(p_message_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; who text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into m from public.sx_messages where id = p_message_id for update;
  if not found or m.unsent_at is not null then raise exception 'Dit bericht bestaat niet meer'; end if;
  if m.sender_id <> uid or not app_private.sx_is_member(m.thread_id) then raise exception 'Je kunt alleen je eigen berichten bewerken of verwijderen'; end if;
  if m.kind = 'system' then raise exception 'Dit bericht kun je niet verwijderen'; end if;
  select nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 1), '') into who from public.profiles p where p.id = uid;
  delete from public.sx_reactions where message_id = m.id;
  update public.sx_messages
     set kind = 'system', body = left(coalesce(who, 'Iemand') || ' heeft een chat verwijderd', 200), media_path = null,
         view_once = false, saved = false, saved_by = null, saved_at = null, edited_at = null, unsent_at = now()
   where id = m.id;
  return true;
end $$;

revoke all on function public.sx_edit_message(uuid, text) from public, anon;
revoke all on function public.sx_unsend_message(uuid) from public, anon;
grant execute on function public.sx_edit_message(uuid, text) to authenticated;
grant execute on function public.sx_unsend_message(uuid) to authenticated;
