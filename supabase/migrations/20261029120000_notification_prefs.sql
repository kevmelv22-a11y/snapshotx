-- Meldingen-instellingen (Snapchat "Notifications"): per account a master switch + one switch per kind.
--   * sx_preferences.notify_prefs: jsonb written by app/notifications.tsx (lib/notification-prefs.ts NotifyPrefs),
--     e.g. {"enabled":true,"chats":true,"calls":true,"mentions":true,"friendRequests":true,"stories":true,
--           "streaks":true,"birthdays":true,"memories":true,"sound":true}. Missing keys mean "on".
--   * sx_push_recipients: same as 20261027120000_chat_mutes.sql, plus recipients who switched off notifications
--     entirely ("enabled": false) or chat notifications ("chats": false) are skipped.
--     supabase/functions/push-message reads "sound" to send silent pushes.
-- NOT APPLIED. Apply after 20261029030000_report_reasons_accounts.sql (needs 20261027120000_chat_mutes.sql for
-- sx_thread_mutes). sx_preferences already has select/insert/update for authenticated with the sx_preferences_self
-- policy (20261019120000), so the new column needs no extra grant.
-- App fallback until applied: the select/upsert of notify_prefs fails with "column does not exist"; the app then
-- keeps the switches on the device only (hooks/useNotifyPrefs.ts) and says so under the list.

alter table public.sx_preferences add column if not exists notify_prefs jsonb not null default '{}'::jsonb;
alter table public.sx_preferences drop constraint if exists sx_preferences_notify_prefs_object;
alter table public.sx_preferences add constraint sx_preferences_notify_prefs_object
  check (jsonb_typeof(notify_prefs) = 'object' and pg_column_size(notify_prefs) < 2048);

create or replace function public.sx_push_recipients(p_message_id uuid)
returns table(user_id uuid, expo_token text, sender_name text, kind text, view_once boolean)
language sql stable security invoker set search_path = '' as $$
  select m2.user_id, t.token, p.display_name, msg.kind, msg.view_once
  from public.sx_messages msg
  join public.sx_members m2 on m2.thread_id = msg.thread_id and m2.user_id <> msg.sender_id
  join public.sx_push_tokens t on t.user_id = m2.user_id
  join public.profiles p on p.id = msg.sender_id
  left join public.sx_preferences pref on pref.user_id = m2.user_id
  where msg.id = p_message_id
    and coalesce((pref.notify_prefs ->> 'enabled')::boolean, true)
    and coalesce((pref.notify_prefs ->> 'chats')::boolean, true)
    and not exists (select 1 from public.sx_blocks b
      where (b.blocker_id = msg.sender_id and b.blocked_id = m2.user_id)
         or (b.blocker_id = m2.user_id and b.blocked_id = msg.sender_id))
    and not exists (select 1 from public.sx_push_recipient_deliveries d
      where d.message_id = p_message_id and d.user_id = m2.user_id)
    and not exists (select 1 from public.sx_thread_mutes mu
      where mu.user_id = m2.user_id and mu.thread_id = msg.thread_id
        and (mu.muted_until is null or mu.muted_until > now()));
$$;
