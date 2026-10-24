# Snapshot X — product roadmap

The project can adopt familiar social-camera capabilities, but must ship with original names, artwork, copy and interaction details. A feature is complete only after its client flow and server-side authorization, deletion/expiry behavior, accessibility, and tests are in place. A local demo is never counted as a live feature.

## Existing foundation

The current branch contains camera capture, photo composition, filters, chat, friend requests, stories, public video discovery, map sharing, avatar editing and outfits, account settings, blocking, reports, and a staff console. Some areas remain partial or rely on local/demo content; verify each against live RPCs and policies before describing it as production-ready.

## Delivery order

1. **Brand and reliability:** original Snapshot X identity; resolve navigation labels and chat send/read errors; replace demo counters/rows with clearly labeled examples or server data; restore the full profile and settings experience.
2. **Camera and creation:** live face effects, video effects, movable text, drawing with undo, stickers, timers, link cards, sound, crop/trim, and save/share flows.
3. **Trust and safety:** review queue with evidence and context, claim/assignment, clear enforcement notices, appeals, staff MFA, searchable audit, and story/content takedowns. Keep user/IP/device ban checks, UUID validation, and the 180-day login-history rule enforced on the server.
4. **Messaging:** chat retention settings, edit/delete, reactions, replies, read receipts, typing/presence, group controls, and optional calls. Enforce permissions and expiry server-side.
5. **Stories and public video:** audience controls, story viewer and viewers, replies, deletion, public posting, and pre-publication review for public video.
6. **Map and memories:** friend-selective location sharing and expiry, persistent opt-in location history, place search, private memories, storage controls, and deletion/export.
7. **Snapshot X+:** store-verified subscriptions and server-owned entitlements before premium features or purchases; no client-written subscription flags.
8. **Release hardening:** migrations consolidated and reviewed, schema/RLS tests, device testing with two accounts, accessibility, privacy review, and reproducible iOS/Android builds.

## Release gates

- Do not apply a migration to the live project until its assumptions are checked against a read-only schema/function dump and the migration has been reviewed.
- Never create test data in the live project for build work.
- Verify visible confirmations, refresh behavior, disabled states, and audit records for moderation actions.
- Keep build credentials and device identifiers out of the repository.
- OTA updates can only update JavaScript/assets compatible with the installed native runtime; native dependency or permission changes need a new binary.
