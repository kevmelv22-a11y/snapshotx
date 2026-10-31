-- sx_stamp_retention (20261028060000) stamps non-keep messages with expires_at = now() + 31 days in a
-- BEFORE INSERT trigger; RLS WITH CHECK runs after it, so the old 24h cap rejected every send (403).
-- Only change: max expires_at 24h -> 31 days + 1 minute. Everything else identical.
alter policy sx_messages_send on public.sx_messages with check (
  sender_id = (select auth.uid())
  and app_private.sx_is_member(thread_id)
  and not exists (
    select 1 from public.sx_members member
    where member.thread_id = sx_messages.thread_id
      and member.user_id <> (select auth.uid())
      and app_private.sx_blocked_with(member.user_id))
  and (expires_at is null or expires_at <= now() + interval '31 days 1 minute')
  and (media_path is null or split_part(media_path, '/', 1) = (select auth.uid())::text)
);
