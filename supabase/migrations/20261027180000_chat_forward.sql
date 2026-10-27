-- Snapchat "Doorsturen" (forward chat messages to other chats).
-- NOT APPLIED to any project yet (source file only). Requires 20261013150000_chat_step4.sql (kind 'system',
-- sx_threads.retention_mode), 20261019120000_sx_data_api_grants_rls.sql (app_private.sx_is_member /
-- app_private.sx_blocked_with) and 20261027090000_chat_edit_unsend.sql (unsent_at).
-- Same rules + Dutch errors as lib/chat-forward.ts (FORWARD_ERRORS) and the demo client:
--   * Only members of the source chat; not when the sender and you blocked each other.
--   * Forwardable: text (incl. avatar stickers; NOT polls '[poll]…'), photo, video, voice. Never one-time snaps
--     (kind 'snap' / view_once), system lines, unsent or expired messages.
--   * 1..10 target chats; you must be a member of each and nobody in it may be blocked with you (same rule as the
--     sx_messages_send insert policy).
--   * Each copy is YOUR message (sender_id = you) with forwarded_at set. A quoted-reply prefix "[reply:…]\n" is
--     dropped. media_path is shared with the original so members of the target chat can read it through the existing
--     sx_media_read policy (a message row in a chat they are member of). This is why a security-definer RPC is
--     needed: the insert policy only allows media from your own storage folder.
--   * expires_at follows the target chat's Verwijderinstelling: keep → null, otherwise now() + 24 h.
-- Push notifications follow from the normal sx_messages insert path (triggers/webhooks), muted chats included.

alter table public.sx_messages add column if not exists forwarded_at timestamptz;
comment on column public.sx_messages.forwarded_at is 'Set when the row is a forwarded copy (Snapchat "Doorgestuurd").';

create or replace function public.sx_forward_message(p_message_id uuid, p_thread_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.sx_messages; t uuid; targets uuid[]; visible text; mode text; n integer := 0;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into m from public.sx_messages where id = p_message_id;
  if not found or m.unsent_at is not null then raise exception 'Dit bericht bestaat niet meer'; end if;
  if not app_private.sx_is_member(m.thread_id) then raise exception 'Je zit niet (meer) in deze chat'; end if;
  visible := btrim(substr(coalesce(m.body, ''), length(coalesce(substring(m.body from
    '^(\[reply:[0-9A-Za-z-]{1,64}\|[0-9A-Za-z-]{1,64}\|(?:text|photo|video|voice|snap|sticker)\|[^\]\n]*\]\n)'), '')) + 1));
  if m.kind not in ('text', 'photo', 'video', 'voice') or coalesce(m.view_once, false)
     or (m.expires_at is not null and m.expires_at <= now())
     or (m.sender_id <> uid and app_private.sx_blocked_with(m.sender_id))
     or (m.kind = 'text' and (visible = '' or visible like '[poll]%'))
     or (m.kind <> 'text' and m.media_path is null) then
    raise exception 'Snaps, peilingen en meldingen kun je niet doorsturen';
  end if;
  select coalesce(array_agg(distinct x), '{}') into targets from unnest(coalesce(p_thread_ids, '{}')) x where x is not null;
  if cardinality(targets) = 0 then raise exception 'Kies minstens één chat'; end if;
  if cardinality(targets) > 10 then raise exception 'Je kunt naar maximaal 10 chats tegelijk doorsturen'; end if;
  foreach t in array targets loop
    if not app_private.sx_is_member(t) then raise exception 'Je zit niet (meer) in deze chat'; end if;
    if exists (select 1 from public.sx_members mm where mm.thread_id = t and mm.user_id <> uid and app_private.sx_blocked_with(mm.user_id)) then
      raise exception 'Naar deze chat kun je niet doorsturen';
    end if;
  end loop;
  foreach t in array targets loop
    select retention_mode into mode from public.sx_threads where id = t;
    insert into public.sx_messages (thread_id, sender_id, kind, body, media_path, view_once, expires_at, forwarded_at)
    values (t, uid, m.kind, case when m.kind = 'text' then visible else m.body end, m.media_path, false,
            case when mode = 'keep' then null else now() + interval '24 hours' end, now());
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.sx_forward_message(uuid, uuid[]) from public, anon;
grant execute on function public.sx_forward_message(uuid, uuid[]) to authenticated;
