# Account deletion — deployed, real deletion untested

Migration `supabase/migrations/20260926081230_account_deletion.sql` was
rollback-tested and applied to the live database on 2026-09-26 with approval
(remote version `20260926083312_account_deletion`). Edge Function version 1 is
ACTIVE. The app flow is not yet in an installed IPA; do not publish it without
disposable-account testing.

The function accepts only an authenticated caller's bearer token and the
explicit `VERWIJDER` confirmation. Set `verify_jwt=false` for this one
function because publishable keys are not JWTs; the function independently
validates the token with `auth.getUser()`. It uses the Supabase-provided
`SUPABASE_SERVICE_ROLE_KEY` only server-side. It marks deletion pending to
prevent fresh Storage uploads, removes user-owned Storage objects via the
Storage API, purges authored content and dependent database records, removes
the Auth user, and clears the marker. Failures return 500 so the same user can
retry; no success is reported until Auth deletion succeeds.

Before production: test errors and retries, two real accounts, shared
conversation preservation, staff/audit retention policy, and actual file
removal. Publish a privacy policy and support contact. An unauthenticated
HTTP probe was rejected by the safety reviewer and not executed; no live
function invocation or real deletion test has run.
