# Live database checklist (Supabase `udantesxduijzhhunadv`)

Written 2026-10-19 after the iOS build showed `permission denied for table sx_locations / sx_stories / sx_friends`,
`Cannot coerce the result to a single JSON object` and an empty "Mijn SnapShot X-code". **Nothing below has been run
against live.** Apply it yourself in the SQL editor (or `supabase db push`) after review.

## What the app expects

Tables (all in `public`; the app only talks to them as `authenticated`):

| Table | Created by | Used by |
| --- | --- | --- |
| `profiles` (`id, username, display_name, avatar_path, activity_score`) | pre-existing live schema (not in this repo) | everywhere |
| `sx_friend_requests`, `sx_friends`, `sx_threads`, `sx_members`, `sx_messages`, `sx_receipts`, `sx_stories`, `sx_story_views`, `sx_story_reactions`, `sx_preferences`, `sx_push_tokens` | `supabase/schema.sql` + `fixes.sql` + `snap-access.sql` | friends, chat, stories, settings, push |
| `sx_locations` (+ `home_confirmed`) | `supabase/map.sql` + `20261001203750_map_home_status` | map, profile, chats "nearby" |
| `sx_blocks` | `20260926075332_user_blocking` (applied 2026-09-26) | blocking, all friend/chat/story policies |
| `sx_reports` | `20260925184916_staff_moderation` (applied 2026-09-25) | report screen |
| `sx_avatar_outfits` (+ `pose`) | `20261007150000_avatar_outfits`, `20261013180000_avatar_pose` | Kast / outfit sync (works locally without it) |
| `sx_preferences.find_me`, `sx_hidden_suggestions`, `sx_suggest_friends()` | `20261011170004_find_friends_privacy` | friend suggestions, settings |
| `sx_login_history`, `sx_staff_bans`, `sx_check_app_access()` | `20261012090000_staff_moderation_consolidated` | sign-in gate, staff console |
| `sx_staff_warnings` + staff RPCs | `20261012090100_staff_panel_1b`, `20261013200000_staff_panel_step11` | staff console |
| `sx_messages.view_seconds` | `20261013120000_snap_view_seconds` | snap timer |
| `sx_entitlements`, `sx_plus_prefs`, `sx_purchase_events` | `20261013120100_sx_plus_entitlements` | Snapshot X+ |
| `sx_threads.retention_mode`, `sx_reactions`, `sx_set_retention()` | `20261013150000_chat_step4` | chat retention + reactions |
| `sx_locations.share_audience/ghost_until/ghost_forever`, `sx_location_allowed` | `20261013170000_map_sharing_ghost` | map privacy / ghost mode |
| `sx_highlight_likes`, `sx_highlight_shares`, `sx_highlight_feed()` | `20261013170100_stories_highlights` | Uitgelicht |
| `memories` columns, `sx_memory_vault` | `20261013171000_memories` | Herinneringen |
| push token columns, `sx_preferences.push_*` | `20261013190000_push_tokens_devices` | push |
| `profiles.gender` | `20261013210000_profile_gender` | registration (Man/Vrouw); the app falls back to sign-up metadata |
| grants + RLS + `sx_ensure_profile()` | **`20261019120000_sx_data_api_grants_rls`** | fixes the 42501 errors and the missing profile row |

Apply in that order; every file after `user_blocking` is written to be re-runnable. `20261019120000` skips (with a
NOTICE) any table or column that does not exist yet, so it can be run now and again after the others.

## Read-only checks (safe to run in the SQL editor)

```sql
-- Which sx tables exist and which API roles have privileges on them
select c.relname as table_name, c.relrowsecurity as rls,
  has_table_privilege('authenticated', c.oid, 'select') as auth_select,
  has_table_privilege('anon', c.oid, 'select') as anon_select,
  has_table_privilege('service_role', c.oid, 'select') as service_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and (c.relname like 'sx\_%' or c.relname in ('profiles','memories'))
order by 1;

-- Policies per table
select tablename, policyname, cmd, permissive from pg_policies where schemaname = 'public' order by 1, 2;

-- Auth users without a profiles row (cause of "Cannot coerce the result to a single JSON object")
select u.id, u.email, u.raw_user_meta_data->>'username' as signup_username
from auth.users u left join public.profiles p on p.id = u.id where p.id is null;

-- Recorded migrations
select version, name from supabase_migrations.schema_migrations order by version;
```
