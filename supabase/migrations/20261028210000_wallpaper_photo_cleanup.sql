-- Chat-achtergrond clean-up: when a photo wallpaper is replaced (new photo, preset or removed), the app deletes the OLD photo
-- from storage (app/chat/[id].tsx setPhoto -> lib/media.ts removeMedia), and an upload that never became the wallpaper is
-- deleted again. snapshotx-media had no delete policy in the migrations, so this adds one for the uploader only, and only
-- for objects nothing uses any more (no chat wallpaper, message, story or memory points at it), so a clean-up can never
-- break media someone can still see. Expired chat media stays with the cleanup-media Edge Function.
-- NOT APPLIED. Apply AFTER 20261028180000_chat_wallpaper_photo.sql (needs sx_threads.wallpaper_path).
-- App/demo mirror: lib/chat-wallpaper.ts canDeleteOwnMedia / staleWallpaperPhoto, lib/demo-client.ts storage.remove.

-- security definer: RLS would hide chats/messages the uploader can no longer see (e.g. a group they left), and a photo
-- that is still the wallpaper there must not be deletable.
create or replace function app_private.sx_media_in_use(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sx_threads t where t.wallpaper_path = p_path)
      or exists (select 1 from public.sx_messages m where m.media_path = p_path)
      or exists (select 1 from public.sx_stories s where s.media_path = p_path)
      or exists (select 1 from public.memories mem where mem.storage_path = p_path)
$$;
revoke all on function app_private.sx_media_in_use(text) from public, anon;
grant execute on function app_private.sx_media_in_use(text) to authenticated;

drop policy if exists sx_media_wallpaper_delete on storage.objects;
create policy sx_media_wallpaper_delete on storage.objects for delete to authenticated using (
  bucket_id = 'snapshotx-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not app_private.sx_media_in_use(name)
);
