# Supabase-migraties: repo ↔ live (udantesxduijzhhunadv)

Gecontroleerd **21 nov 2026 (00:10-sessie, Europe/Amsterdam)** met `list_migrations` + alleen-lezen schema-queries. Live versienummers zijn de toepassingstijd (apply_migration), dus de koppeling gaat op **naam**.

## Live onder dezelfde naam
Alle repo-migraties behalve de 10 hieronder staan live onder hun eigen naam (o.a. `report_reasons_accounts`, `notification_prefs`, `friend_ranks`, `my_ai_quota`, `ai_reports`) — daarna `staff_ai_reports` (20261121000000) en nieuwste: `fk_covering_indexes` (repo 20261127190000, live versie 20261127183010; 27 nov 2026).

## Niet onder eigen naam live — en waarom dat klopt
| Repo-bestand | Status live | Bewijs (alleen-lezen) |
|---|---|---|
| 20261007150000_avatar_outfits | inhoud live (eerder handmatig) | tabel `sx_avatar_outfits` + `sx_friend_avatar_outfits()` bestaan |
| 20261009212600_fix_activity_score_trigger | live onder naam `20261009212600_fix_activity_score_trigger` | in list_migrations |
| 20261010110000_staff_console_quick_fixes | **vervangen** door `snaplion_staff_*` + `staff_panel_1b`/`staff_panel_step11` | `sx_staff_stats` bestaat niet en wordt door de app niet gebruikt |
| 20261012090000_staff_moderation_consolidated | deels live (indexen); helpers via `staff_helpers_live` | `sx_login_history_device` bestaat; **niet opnieuw draaien** (overschrijft nieuwere storage/chat-policies) |
| 20261013170000_map_sharing_ghost | inhoud live | `sx_location_allowed`, `ghost_until` bestaan |
| 20261013180000_avatar_pose | inhoud live | kolom `pose` bestaat |
| 20261013190000_push_tokens_devices | **niet nodig** | `sx_push_tokens` heeft geen `device_id`/`push_previews`; de app en push-message gebruiken die kolommen niet |
| 20261013190100_media_buckets | **niet nodig** | live bucket = `snapshotx-media` (+ `legal`); de app gebruikt alleen die |
| 20261013210000_profile_gender | inhoud live | `profiles.gender` + `sx_profile_gender_from_auth` bestaan |
| 20261019120000_sx_data_api_grants_rls | inhoud live (grants/RLS-helpers) | `app_private.sx_location_allows` e.a. bestaan |

## 27 nov 2026 — `fk_covering_indexes`
- 31 indexen voor alle `sx_*`-foreign keys die de performance-advisor als "unindexed" meldde (o.a. `sx_members.user_id`, `sx_messages.sender_id`, `sx_receipts.user_id`, `sx_friends.friend_id`, `sx_stories.owner_id`). Alleen indexen: geen tabel-, policy-, grant- of datawijziging; `pw_*` niet aangeraakt.
- PGlite: /workspace/pgtest/s1127-fk-indexes.mjs (2× toegepast = idempotent, RLS/policies ongewijzigd). Live na toepassen: 0 `sx_*`-foreign keys zonder index.

## Regels
- Nooit een van de "vervangen/niet nodig"-bestanden alsnog toepassen zonder nieuwe review: ze zijn ouder dan de live policies.
- Nieuwe migraties één voor één via `apply_migration`, eerst PGlite-test (/workspace/pgtest) + check op bestaande RLS/functies.
- Het Supabase-project bevat ook `pw_*`-migraties van een andere app (Postwacht); niet aanraken.
