-- Fix: media in chats set to "Bewaren" (keep) and media saved in chat could not be opened by the other members.
-- NOT APPLIED to any project yet — review and run it yourself.
--
-- The storage read policy sx_media_read (end state: 20261012090000_staff_moderation_consolidated.sql) required
-- `m.expires_at > now()`. Kept messages have expires_at = NULL (sx_apply_retention 'keep', sx_set_message_saved,
-- sx_forward_message into a keep chat, and the app's own insert in a keep chat), and `NULL > now()` is not true, so
-- recipients got no signed URL for photos / videos / voice notes. The sx_messages_read row policy already treats NULL
-- as "never expires"; storage now does the same. Everything else is unchanged (account active, removed media,
-- membership, blocks, view-once 90 s window, stories). App/demo mirror: lib/media-access.ts canReadMedia().

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
  )
);
