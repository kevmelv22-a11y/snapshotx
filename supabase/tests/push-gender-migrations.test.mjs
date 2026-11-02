import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('gender sync: trigger on auth.users metadata update, only male/female, security definer, not callable by clients', () => {
  const s = rd('../migrations/20261102220000_profile_gender_sync.sql');
  assert.match(s, /after update of raw_user_meta_data on auth\.users/);
  assert.match(s, /g in \('male', 'female'\)/);
  assert.match(s, /security definer set search_path = public, auth/);
  assert.match(s, /revoke all on function public\.sx_profile_gender_sync_from_auth\(\) from public, anon, authenticated/);
  assert.doesNotMatch(s, /delete from/i);
});

test('claim push token: auth required, token format checked, removes other accounts only for the same token', () => {
  const s = rd('../migrations/20261102221000_claim_push_token.sql');
  assert.match(s, /auth\.uid\(\)/);
  assert.match(s, /if uid is null then raise exception/);
  assert.match(s, /p_token !~ '\^Expo\(nent\)\?PushToken/);
  assert.match(s, /delete from public\.sx_push_tokens where token = p_token and user_id <> uid;/);
  assert.match(s, /revoke all on function public\.sx_claim_push_token\(text\) from public, anon;/);
  assert.match(s, /grant execute on function public\.sx_claim_push_token\(text\) to authenticated;/);
});

test('push-message sends Android high priority on the messages channel; device registration claims the token', () => {
  const f = rd('../functions/push-message/index.ts');
  assert.match(f, /priority: 'high'/);
  assert.match(f, /channelId: 'messages'/);
  const d = rd('../../lib/push-device.ts');
  assert.match(d, /rpc\('sx_claim_push_token',\{p_token:token\}\)/);
});
