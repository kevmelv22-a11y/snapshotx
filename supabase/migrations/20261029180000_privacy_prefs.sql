-- Snapchat-style "Wie kan…" (Instellingen › Privacy › Wie kan…, app/who-can.tsx, lib/privacy-prefs.ts).
--   * sx_preferences.privacy_prefs: jsonb {"story": "everyone" | "friends"} — the default audience for new stories.
--     compose.tsx writes it to sx_stories.visibility; the existing sx_stories_read policy already enforces
--     visibility (everyone vs. friends) and blocks, so no policy change is needed.
--   * Contact (chats/snaps/calls) stays friends-only via sx_open_thread; Snel toevoegen stays sx_preferences.find_me.
-- sx_preferences already has select/insert/update for authenticated with the sx_preferences_self policy
-- (20261019120000_sx_data_api_grants_rls.sql), so only the column is added. Until this runs, the app keeps
-- the choice on the device (hooks/usePrivacyPrefs.ts treats the missing column as "not ready").
-- NOT APPLIED. Idempotent; run after 20261029120000_notification_prefs.sql.

alter table public.sx_preferences add column if not exists privacy_prefs jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sx_preferences_privacy_prefs_shape') then
    alter table public.sx_preferences add constraint sx_preferences_privacy_prefs_shape check (
      jsonb_typeof(privacy_prefs) = 'object'
      and (not privacy_prefs ? 'story' or privacy_prefs->>'story' in ('everyone', 'friends'))
    );
  end if;
end $$;

notify pgrst, 'reload schema';
