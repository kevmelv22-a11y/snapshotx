import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackHandle, loadOwnProfile, ownIdentity, parseFriendCode } from './own-profile.ts';

const user = { id: '3f2a9c1e-0000-4000-8000-000000000001', email: 'kevin@example.com', user_metadata: { username: 'kv.savage', display_name: 'Kevin' } };
const plain = { id: '3f2a9c1e-0000-4000-8000-000000000001', email: 'kevin@example.com', user_metadata: { username: 'kevin_v', display_name: 'Kevin' } };

test('stored username wins and yields a username QR', () => {
  const p = ownIdentity(plain, { username: 'kevin', display_name: 'Kevin V', activity_score: 12 });
  assert.equal(p.handle, 'kevin'); assert.equal(p.hasUsername, true); assert.equal(p.displayName, 'Kevin V');
  assert.equal(p.qrValue, 'https://snapshot-x.nl/add/kevin'); assert.equal(p.activityScore, 12);
});

test('missing profile row: never an empty "@", QR by user id', () => {
  const p = ownIdentity(plain, null, 'fallback');
  assert.equal(p.handle, 'kevin_v'); assert.equal(p.hasUsername, false); assert.equal(p.source, 'metadata');
  assert.equal(p.qrValue, `https://snapshot-x.nl/add/${plain.id}`);
  const bare = ownIdentity({ id: plain.id }, { username: null, display_name: null });
  assert.equal(bare.handle, fallbackHandle(plain.id)); assert.equal(bare.handle, 'user_3f2a9c1e');
  assert.equal(bare.displayName, 'user_3f2a9c1e'); assert.equal(bare.source, 'fallback');
  // Invalid sign-up username (dot) falls back to the id part, display name still from metadata.
  const dotted = ownIdentity(user, null);
  assert.equal(dotted.handle, 'user_3f2a9c1e'); assert.equal(dotted.displayName, 'Kevin');
});

test('stored username with a dot is shown as is, QR falls back to the id form', () => {
  const p = ownIdentity(user, { username: 'kv.savage', display_name: 'Kevin' });
  assert.equal(p.handle, 'kv.savage'); assert.equal(p.hasUsername, true);
  assert.equal(p.qrValue, `https://snapshot-x.nl/add/${user.id}`);
});

test('friend codes: username and id variants', () => {
  assert.deepEqual(parseFriendCode('https://snapshot-x.nl/add/kevin'), { kind: 'username', value: 'kevin' });
  assert.deepEqual(parseFriendCode(`snapshotx://friends?id=${plain.id.toUpperCase()}`), { kind: 'id', value: plain.id });
  assert.equal(parseFriendCode('https://evil.example/?u=kevin'), null);
  assert.equal(parseFriendCode('snapshotx://friends?u=A'), null);
});

function client({ row = null, error = null, rpc = null, rpcError = null } = {}) {
  const calls = [];
  return { calls,
    from: () => ({ select: cols => ({ eq: () => ({ maybeSingle: async () => { calls.push(`select:${cols}`); return { data: row, error }; } }) }) }),
    rpc: async name => { calls.push(`rpc:${name}`); return { data: rpc, error: rpcError }; } };
}

test('loadOwnProfile: existing row, created row, missing RPC and unavailable table', async () => {
  let c = client({ row: { username: 'kevin', display_name: 'Kevin', activity_score: 5 } });
  let p = await loadOwnProfile(c, plain);
  assert.equal(p.handle, 'kevin'); assert.deepEqual(c.calls, ['select:username,display_name,activity_score']);

  c = client({ row: null, rpc: [{ id: plain.id, username: 'kevin_v', display_name: 'Kevin' }] });
  p = await loadOwnProfile(c, plain);
  assert.equal(p.source, 'created'); assert.equal(p.hasUsername, true); assert.equal(p.qrValue, 'https://snapshot-x.nl/add/kevin_v');

  c = client({ row: null, rpcError: { code: 'PGRST202', message: 'Could not find the function public.sx_ensure_profile' } });
  p = await loadOwnProfile(c, plain);
  assert.equal(p.handle, 'kevin_v'); assert.equal(p.hasUsername, false); assert.equal(p.notice, '');

  c = client({ error: { code: '42501', message: 'permission denied for table profiles' } });
  p = await loadOwnProfile(c, plain);
  assert.equal(p.handle, 'kevin_v'); assert.match(p.notice, /^Je profiel: nu niet beschikbaar/);
  assert.deepEqual(c.calls, ['select:username,display_name,activity_score']);
});
