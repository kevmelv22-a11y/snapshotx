-- Snapchat: "Chats are automatically deleted 24 hours after everyone in the conversation has viewed the Chat … or 31 days
-- after the Chat was sent, whichever is sooner." (support, checked 2026-10-28)
-- 20261028060000_unopened_chats_31d.sql starts the 24 h timer when the LAST other member opens a chat. When a member who
-- had NOT opened it leaves (sx_leave_group) or is removed (sx_remove_group_member), everyone remaining has now viewed it,
-- but nothing recomputed expires_at → the chat stayed on its 31-day cap. Now the timer starts at that moment.
-- App/demo mirror: lib/chat-retention.ts (everyoneViewedAt + leaveEvents), lib/demo-client.ts retentionAfterLeave.
-- Requires 20261028030000_message_retention_mode.sql and 20261028060000_unopened_chats_31d.sql first.

create or replace function app_private.sx_retention_after_leave() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sx_messages msg
     set expires_at = least(msg.created_at + interval '31 days',
                            now() + case when coalesce(msg.retention_mode, t.retention_mode, '24h') = 'after_view'
                                         then interval '10 minutes' else interval '24 hours' end)
    from public.sx_threads t
   where t.id = msg.thread_id
     and msg.thread_id = old.thread_id
     and msg.kind not in ('snap', 'system')
     and not coalesce(msg.saved, false)
     and coalesce(msg.retention_mode, t.retention_mode, '24h') <> 'keep'
     and msg.sender_id <> old.user_id
     -- the leaver had not opened it (otherwise the timer was already right) …
     and not exists (select 1 from public.sx_receipts r
                      where r.message_id = msg.id and r.user_id = old.user_id and r.opened_at is not null)
     -- … at least one other member remains (a chat with nobody else never starts a timer) …
     and exists (select 1 from public.sx_members mem where mem.thread_id = msg.thread_id and mem.user_id <> msg.sender_id)
     -- … and every remaining other member has opened it.
     and not exists (select 1 from public.sx_members mem
                      where mem.thread_id = msg.thread_id and mem.user_id <> msg.sender_id
                        and not exists (select 1 from public.sx_receipts r
                                         where r.message_id = msg.id and r.user_id = mem.user_id and r.opened_at is not null));
  return null;
end $$;
revoke all on function app_private.sx_retention_after_leave() from public, anon, authenticated;

drop trigger if exists sx_members_retention_after_leave on public.sx_members;
create trigger sx_members_retention_after_leave after delete on public.sx_members
  for each row execute function app_private.sx_retention_after_leave();
