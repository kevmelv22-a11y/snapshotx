-- Snapchat+ Chat Wallpaper from the Camera Roll: an X+ member can use one of their own photos (optionally blurred)
-- as the shared wallpaper of a 1:1 or group chat. Everyone in the chat sees it (friends without X+ too).
-- NOT APPLIED. Apply AFTER 20261028150000_chat_wallpaper.sql (and 20261028000000_media_read_kept_chats.sql, whose
-- sx_media_read policy is recreated here with one extra clause). App/demo mirror: lib/chat-wallpaper.ts,
-- lib/demo-client.ts sx_set_wallpaper_photo / sx_set_wallpaper.

alter table public.sx_threads add column if not exists wallpaper_path text;
alter table public.sx_threads add column if not exists wallpaper_blur boolean not null default false;
alter table public.sx_threads drop constraint if exists sx_threads_wallpaper_check;
alter table public.sx_threads add constraint sx_threads_wallpaper_check
  check (wallpaper in ('none','sterren','aurora','oceaan','roze','grafiet','photo')
         and ((wallpaper = 'photo') = (wallpaper_path is not null)));

-- Presets / remove: same rules as 20261028150000, and clear any photo.
create or replace function public.sx_set_wallpaper(p_thread_id uuid, p_wallpaper text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  if not app_private.sx_is_member(p_thread_id) then raise exception 'Je zit niet (meer) in deze chat.'; end if;
  if p_wallpaper is null or p_wallpaper not in ('none','sterren','aurora','oceaan','roze','grafiet') then raise exception 'Deze achtergrond bestaat niet.'; end if;
  if not (app_private.sx_has_tier(auth.uid(), 'plus') or app_private.sx_has_tier(auth.uid(), 'family')
          or app_private.sx_has_tier(auth.uid(), 'lens') or app_private.sx_has_tier(auth.uid(), 'platinum')) then
    raise exception 'Alleen Snapshot X+-leden kunnen de achtergrond wijzigen.';
  end if;
  select wallpaper into cur from public.sx_threads where id = p_thread_id for update;
  if cur = p_wallpaper then return; end if;
  update public.sx_threads set wallpaper = p_wallpaper, wallpaper_path = null, wallpaper_blur = false where id = p_thread_id;
  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (p_thread_id, auth.uid(), 'system', left(coalesce(p_text, 'Chat-achtergrond gewijzigd'), 200), null);
end $$;
revoke all on function public.sx_set_wallpaper(uuid, text, text) from public, anon;
grant execute on function public.sx_set_wallpaper(uuid, text, text) to authenticated;

-- Photo: must be the caller's own upload ("<uid>/<uuid>.jpg" in snapshotx-media). Same photo with only the blur
-- changed updates silently (no system line); same photo + same blur is a no-op.
create or replace function public.sx_set_wallpaper_photo(p_thread_id uuid, p_path text, p_blur boolean, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare cur record;
begin
  if not app_private.sx_is_member(p_thread_id) then raise exception 'Je zit niet (meer) in deze chat.'; end if;
  if not (app_private.sx_has_tier(auth.uid(), 'plus') or app_private.sx_has_tier(auth.uid(), 'family')
          or app_private.sx_has_tier(auth.uid(), 'lens') or app_private.sx_has_tier(auth.uid(), 'platinum')) then
    raise exception 'Alleen Snapshot X+-leden kunnen de achtergrond wijzigen.';
  end if;
  if p_path is null
     or p_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
     or split_part(p_path, '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'snapshotx-media' and o.name = p_path) then
    raise exception 'Deze foto kan niet als achtergrond worden gebruikt.';
  end if;
  select wallpaper, wallpaper_path, wallpaper_blur into cur from public.sx_threads where id = p_thread_id for update;
  if cur.wallpaper = 'photo' and cur.wallpaper_path = p_path and cur.wallpaper_blur = coalesce(p_blur, false) then return; end if;
  update public.sx_threads set wallpaper = 'photo', wallpaper_path = p_path, wallpaper_blur = coalesce(p_blur, false) where id = p_thread_id;
  if cur.wallpaper = 'photo' and cur.wallpaper_path = p_path then return; end if;
  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (p_thread_id, auth.uid(), 'system', left(coalesce(p_text, 'Chat-achtergrond gewijzigd'), 200), null);
end $$;
revoke all on function public.sx_set_wallpaper_photo(uuid, text, boolean, text) from public, anon;
grant execute on function public.sx_set_wallpaper_photo(uuid, text, boolean, text) to authenticated;

-- Storage read: 20261028000000 policy unchanged + members of a chat may read that chat's wallpaper photo.
drop policy if exists sx_media_read on storage.objects;
create policy sx_media_read on storage.objects for select to authenticated using (
  bucket_id='snapshotx-media'
  and app_private.sx_account_active()
  and not exists(select 1 from public.sx_messages removed where removed.media_path=name and removed.media_deleted_at is not null)
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (
      select 1 from public.sx_messages m where m.media_path=name
        and app_private.sx_is_member(m.thread_id)
        and not app_private.sx_blocked_with(m.sender_id)
        and (m.expires_at is null or m.expires_at>now())
        and (not m.view_once or exists (
          select 1 from public.sx_receipts r where r.message_id=m.id and r.user_id=(select auth.uid())
            and r.opened_at>now()-interval '90 seconds'
        ))
    )
    or exists (
      select 1 from public.sx_stories s where s.media_path=name
        and not app_private.sx_blocked_with(s.owner_id)
        and (s.owner_id=(select auth.uid()) or (s.expires_at>now() and
          (s.visibility='everyone' or exists(select 1 from public.sx_friends f where f.user_id=(select auth.uid()) and f.friend_id=s.owner_id))))
    )
    or exists (
      select 1 from public.sx_threads t where t.wallpaper='photo' and t.wallpaper_path=name
        and app_private.sx_is_member(t.id)
    )
  )
);
