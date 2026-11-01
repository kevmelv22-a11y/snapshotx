import assert from 'node:assert/strict';
import test from 'node:test';
import { pushDeniedText, pushRoute, pushThreadId, pushTokenRow, shouldAutoRegister, showInForeground, signOutThisDevice } from './push-logic.ts';

const T = '0b5c3f0e-3c1a-4a7e-9d3e-1f2a3b4c5d6e';

test('tap on a server push (thread_id) opens that chat; ids are normalised', () => {
  assert.equal(pushRoute({ thread_id: T, message_id: 'x' }), `/chat/${T}`);
  assert.equal(pushRoute({ thread_id: ` ${T.toUpperCase()} ` }), `/chat/${T}`);
  assert.equal(pushThreadId({ route: `/chat/${T}`, kind: 'chat' }), T);
});

test('tap on a friend request opens Vrienden; unknown / unsafe payloads go nowhere', () => {
  assert.equal(pushRoute({ kind: 'friend_request', route: '/friends' }), '/(tabs)/friends');
  for (const bad of [null, undefined, 'x', [T], {}, { thread_id: 'demo-1' }, { route: 'https://evil.example/chat/' + T }, { route: `/chat/${T}/../../settings` }, { route: '/staff' }, { thread_id: { $ne: 1 } }])
    assert.equal(pushRoute(bad), null, JSON.stringify(bad));
});

test('foreground: banner everywhere except in the chat that is open', () => {
  assert.equal(showInForeground({ thread_id: T }, T), false);
  assert.equal(showInForeground({ thread_id: T }, T.toUpperCase()), false);
  assert.equal(showInForeground({ thread_id: T }, '1b5c3f0e-3c1a-4a7e-9d3e-1f2a3b4c5d6e'), true);
  assert.equal(showInForeground({ thread_id: T }, null), true);
  assert.equal(showInForeground({ kind: 'friend_request' }, T), true);
});

test('denied text points to the right settings path per platform', () => {
  assert.match(pushDeniedText('android'), /Instellingen › Apps › SnapShot X › Meldingen/);
  assert.doesNotMatch(pushDeniedText('android'), /iPhone/);
  assert.match(pushDeniedText('ios'), /iPhone/);
});

test('silent token refresh only with existing permission, master switch on, native, non-demo', () => {
  const base = { os: 'android', demo: false, permission: 'granted', masterOn: true };
  assert.equal(shouldAutoRegister(base), true);
  assert.equal(shouldAutoRegister({ ...base, masterOn: null }), true);
  assert.equal(shouldAutoRegister({ ...base, masterOn: false }), false);
  assert.equal(shouldAutoRegister({ ...base, permission: 'undetermined' }), false, 'never prompts on launch');
  assert.equal(shouldAutoRegister({ ...base, permission: 'denied' }), false);
  assert.equal(shouldAutoRegister({ ...base, os: 'web' }), false);
  assert.equal(shouldAutoRegister({ ...base, demo: true }), false);
});

test('token row matches the live sx_push_tokens columns', () => {
  assert.deepEqual(Object.keys(pushTokenRow('u', 'ExponentPushToken[abc]', 0)).sort(), ['token', 'updated_at', 'user_id']);
  assert.equal(pushTokenRow('u', 't', 0).updated_at, '1970-01-01T00:00:00.000Z');
});

test('Uitloggen: forget token first, then sign out only this device; cleanup errors never block', async () => {
  const calls = [];
  const r = await signOutThisDevice({ forgetToken: async () => { calls.push('forget'); }, signOut: async o => { calls.push(['signOut', o.scope]); } });
  assert.deepEqual(calls, ['forget', ['signOut', 'local']]);
  assert.equal(r.tokenRemoved, true);
  let signedOut = false;
  const r2 = await signOutThisDevice({ forgetToken: async () => { throw new Error('offline'); }, signOut: async () => { signedOut = true; } });
  assert.equal(signedOut, true);
  assert.equal(r2.tokenRemoved, false);
});

test('push wiring: PushSync mounted at the root, one registration path, Uitloggen forgets the token (scope local)', async () => {
  const fs = await import('node:fs');
  const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(read('app/_layout.tsx'), /<PushSync\/>/);
  const notif = read('app/notifications.tsx');
  assert.match(notif, /registerPushDevice\(uid,\{prompt:true\}\)/);
  assert.doesNotMatch(notif, /getExpoPushTokenAsync/, 'registration lives in lib/push-device.ts only');
  const settings = read('app/settings.tsx');
  assert.match(settings, /void signOutDevice\(\)/);
  assert.doesNotMatch(settings, /supabase\.auth\.signOut\(\)/, 'a bare signOut() is global: it would sign out every device');
  const device = read('lib/push-device.ts');
  assert.ok(device.indexOf('ensureAndroidChannels()') < device.indexOf('requestPermissionsAsync'), 'Android channels before the permission prompt');
  const sync = read('components/PushSync.tsx');
  assert.match(sync, /getLastNotificationResponse\(\)/, 'cold start: the tap that launched the app opens the chat');
  assert.match(sync, /addNotificationResponseReceivedListener/);
  assert.match(sync, /shouldShowBanner:show/);
  assert.match(read('app/chat/[id].tsx'), /setActiveChat\(id\)/);
});
