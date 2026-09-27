# Media cleanup Edge Function — scheduled, deletion test pending

Version 3 is deployed on the live project. `verify_jwt=false` is intentional:
the `snapshotx-media-cleanup` cron job sends a dedicated 256-bit Vault token in
`x-snapshotx-job-key` every 30 minutes. The function rejects missing or
incorrect tokens. No service-role key is in the cron command or mobile app.

A request without the token returned HTTP 401. An authorized manual `pg_net`
request returned HTTP 200 with `{pathsDeleted:0}`; there were no expired paths.
The cron definition is active and reads the Vault secret by name at execution.
The first three scheduled runs at 01:30, 02:00 and 02:30 UTC on 2026-09-26
all succeeded; their `pg_net` responses were HTTP 200 with `{pathsDeleted:0}`.
This proves the schedule reaches the function, but not physical deletion.

Each run removes up to 200 expired, unreferenced media paths from Storage and
marks referencing message/story rows with `media_deleted_at`. It leaves
unexpired media and the history rows intact. Actual removal of an expired
uploaded file has **not** been tested; do that with disposable accounts and a
real device before trusting production behavior.
