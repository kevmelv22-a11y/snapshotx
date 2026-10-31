import assert from 'node:assert/strict';
import test from 'node:test';
import { authRedirectUrl, bundleLeaks, realWebEnvProblems } from './web-env.ts';

const jwt = role => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`;
const ok = { EXPO_PUBLIC_SUPABASE_URL: 'https://udantesxduijzhhunadv.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123' };

test('auth e-mail links come back to the web origin on web, to the app scheme on iOS/Android', () => {
  assert.equal(authRedirectUrl('web', 'https://snapshot-x.nl'), 'https://snapshot-x.nl/auth/callback');
  assert.equal(authRedirectUrl('web', 'http://localhost:8081'), 'http://localhost:8081/auth/callback');
  assert.equal(authRedirectUrl('ios', 'https://snapshot-x.nl'), 'snapshotx://auth/callback');
  assert.equal(authRedirectUrl('web', undefined), 'snapshotx://auth/callback');
  assert.equal(authRedirectUrl('web', 'javascript:alert(1)'), 'snapshotx://auth/callback');
});

test('real web env: OK with project URL + publishable/anon key', () => {
  assert.deepEqual(realWebEnvProblems(ok), []);
  assert.deepEqual(realWebEnvProblems({ ...ok, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('anon') }), []);
});

test('real web env: blocks demo flags, missing values and any secret key, without echoing it', () => {
  assert.equal(realWebEnvProblems({}).length, 2);
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_DEMO_MODE: '1' })[0], /demo/);
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_DEMO_BUTTON: '1' })[0], /publieke build/);
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_SUPABASE_URL: 'http://evil.example' })[0], /supabase\.co/);
  const secret = realWebEnvProblems({ ...ok, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_zzz' });
  assert.match(secret[0], /geheime sleutel/); assert.ok(!secret.join().includes('sb_secret_zzz'));
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('service_role') })[0], /geheime/);
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'hello' })[0], /geen publishable/);
  assert.match(realWebEnvProblems({ ...ok, EXPO_PUBLIC_RC: 'sk_live1234' })[0], /EXPO_PUBLIC_RC lijkt een geheime sleutel/);
  assert.deepEqual(realWebEnvProblems({ ...ok, EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_abc' }), [], 'public RevenueCat key is fine');
});

test('bundle scan finds leaked secrets', () => {
  assert.deepEqual(bundleLeaks('var k="sb_publishable_abc"'), []);
  assert.equal(bundleLeaks('var k="sb_secret_abcdefghijkl"').length, 1);
  assert.equal(bundleLeaks('{"role":"service_role"}').length, 1);
});
