-- Run after snap-access.sql. Adds per-recipient push delivery tracking so the
-- push Edge Function can be called by a Database Webhook without sending
-- duplicate notifications, and lets the webhook resolve recipients safely.
-- NOT YET APPLIED to the live project — review and run this yourself in the
-- Supabase SQL editor, then configure the Database Webhook as described in
-- supabase/functions/push-message/README.md.

-- Preserve the earlier message-level sx_push_deliveries table and its data.
create table if not exists public.sx_push_recipient_deliveries (
  message_id uuid not null references public.sx_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.sx_push_recipient_deliveries enable row level security;
-- Only the service role (used by the Edge Function) ever touches this table.
revoke all on public.sx_push_recipient_deliveries from public, anon, authenticated;
grant select, insert on public.sx_push_recipient_deliveries to service_role;

-- Lets the service-role Edge Function resolve "who is in this thread besides
-- the sender" and "what display name to show" without needing a broader
-- service-role bypass of RLS logic to reimplement in the function itself.
-- RPC is in public because app_private is deliberately not an exposed API schema.
-- EXECUTE remains restricted to the backend role.
create or replace function public.sx_push_recipients(p_message_id uuid)
returns table(user_id uuid, expo_token text, sender_name text, kind text, view_once boolean)
language sql stable security invoker set search_path = '' as $$
  select m2.user_id, t.token, p.display_name, msg.kind, msg.view_once
  from public.sx_messages msg
  join public.sx_members m2 on m2.thread_id = msg.thread_id and m2.user_id <> msg.sender_id
  join public.sx_push_tokens t on t.user_id = m2.user_id
  join public.profiles p on p.id = msg.sender_id
  where msg.id = p_message_id
    and not exists (
      select 1 from public.sx_push_recipient_deliveries d
      where d.message_id = p_message_id and d.user_id = m2.user_id
    );
$$;
revoke all on function public.sx_push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.sx_push_recipients(uuid) to service_role;
-- Only callable with the service role (Edge Function), never from the app.
