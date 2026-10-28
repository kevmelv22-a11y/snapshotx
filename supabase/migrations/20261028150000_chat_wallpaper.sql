-- Snapchat+ Chat Wallpaper: "customizing the background wallpaper of Chats and Group Chats for everyone in the Chat to see"
-- (support, checked 2026-10-28). Friends without a subscription see it too; every chat member can set/change/clear it (no subscription needed),
-- and the chat gets a grey line ("Kevin heeft de chat-achtergrond gewijzigd in Aurora").
-- NOT APPLIED. Requires the chat step-4 helpers. Open to every chat member: no X+ check (Kevin, 2026-10-28).
-- App/demo mirror: lib/chat-wallpaper.ts, lib/demo-client.ts sx_set_wallpaper.

alter table public.sx_threads add column if not exists wallpaper text not null default 'none';
alter table public.sx_threads drop constraint if exists sx_threads_wallpaper_check;
alter table public.sx_threads add constraint sx_threads_wallpaper_check
  check (wallpaper in ('none','sterren','aurora','oceaan','roze','grafiet'));

create or replace function public.sx_set_wallpaper(p_thread_id uuid, p_wallpaper text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  if not app_private.sx_is_member(p_thread_id) then raise exception 'Je zit niet (meer) in deze chat.'; end if;
  if p_wallpaper is null or p_wallpaper not in ('none','sterren','aurora','oceaan','roze','grafiet') then raise exception 'Deze achtergrond bestaat niet.'; end if;
  select wallpaper into cur from public.sx_threads where id = p_thread_id for update;
  if cur = p_wallpaper then return; end if;
  update public.sx_threads set wallpaper = p_wallpaper where id = p_thread_id;
  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (p_thread_id, auth.uid(), 'system', left(coalesce(p_text, 'Chat-achtergrond gewijzigd'), 200), null);
end $$;
revoke all on function public.sx_set_wallpaper(uuid, text, text) from public, anon;
grant execute on function public.sx_set_wallpaper(uuid, text, text) to authenticated;
