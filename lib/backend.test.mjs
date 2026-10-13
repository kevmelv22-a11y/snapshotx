import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import * as D from './backend/disappear.ts';
import * as P from './backend/push.ts';
import * as S from './backend/storage.ts';

const T0 = Date.UTC(2026, 9, 13, 12), { DAY, HOUR, MIN } = D;

test('viewed snap disappears after its timer (x2 when replayed)', () => {
  const s = { kind: 'snap', createdAt: T0, timerS: 5, openedAt: T0 + MIN };
  assert.equal(D.isExpired(s, T0 + MIN + 4999), false);
  assert.equal(D.isExpired(s, T0 + MIN + 5000), true);
  assert.equal(D.expiresAt({ ...s, replayed: true }), T0 + MIN + 10000);
  assert.equal(D.expiresAt({ ...s, timerS: null }), T0 + MIN + 10000);
  assert.equal(D.expiresAt({ ...s, saved: true }), null);
});
test('unopened snaps expire after 30 days, stories after 24h', () => {
  const s = { kind: 'snap', createdAt: T0, timerS: 3, openedAt: null };
  assert.equal(D.isExpired(s, T0 + 30 * DAY - 1), false);
  assert.equal(D.isExpired(s, T0 + 30 * DAY), true);
  assert.equal(D.expiryReason(s), 'unopened-30d');
  assert.equal(D.isExpired({ kind: 'story', createdAt: T0 }, T0 + 24 * HOUR), true);
  assert.equal(D.isExpired({ kind: 'story', createdAt: T0 }, T0 + 24 * HOUR - 1), false);
});
test('chat follows the per-chat retention setting', () => {
  const c = { kind: 'chat', createdAt: T0, viewedAt: T0 + HOUR };
  assert.equal(D.expiresAt({ ...c, retention: 'keep' }), null);
  assert.equal(D.expiresAt({ ...c, retention: '24h' }), T0 + HOUR + DAY);
  assert.equal(D.expiresAt({ ...c, retention: 'after_view', leftAt: T0 + 2 * HOUR }), T0 + 2 * HOUR + 10 * MIN);
  assert.equal(D.expiresAt({ ...c, retention: '24h', viewedAt: null }), null);
  assert.equal(D.expiresAt({ ...c, retention: '24h', saved: true }), null);
});
test('sweep splits items and labels remaining time', () => {
  const items = [{ kind: 'story', createdAt: T0 - DAY }, { kind: 'story', createdAt: T0 }];
  const r = D.sweep(items, T0);
  assert.equal(r.deleted.length, 1); assert.equal(r.deleted[0].reason, 'story-24h'); assert.equal(r.keep.length, 1);
  assert.equal(D.remainingLabel(items[1], T0 + HOUR), '23 u');
  assert.equal(D.remainingLabel({ kind: 'snap', createdAt: T0, timerS: 5, openedAt: T0 }, T0 + 2000), '3s');
});
test('push payloads for the 4 kinds never leak snap content; previews opt-in', () => {
  assert.equal(P.buildPayload({ kind: 'snap', from: 'Sam', threadId: 't1' }).body, 'Nieuwe snap 👻');
  assert.equal(P.buildPayload({ kind: 'chat', from: 'Sam', threadId: 't1', preview: 'geheim' }).body, 'Nieuw bericht');
  assert.equal(P.buildPayload({ kind: 'chat', from: 'Sam', threadId: 't1', preview: 'hoi' }, { previews: true }).body, 'hoi');
  assert.match(P.buildPayload({ kind: 'screenshot', from: 'Sam', threadId: 't1', what: 'snap' }).body, /screenshot/);
  const f = P.buildPayload({ kind: 'friend_request', from: 'Sam', requestId: 'r' });
  assert.equal(f.data.route, '/friends'); assert.equal(f.channel, 'social');
});
test('mock provider delivers to listeners; registration stores token only when granted', async () => {
  const p = new P.MockPushProvider(true, () => T0), got = [];
  const off = p.onReceive(d => got.push(d));
  await p.present(P.buildPayload({ kind: 'snap', from: 'A', threadId: 't' })); off();
  await p.present(P.buildPayload({ kind: 'snap', from: 'B', threadId: 't' }));
  assert.equal(got.length, 1); assert.equal(p.delivered.length, 2); assert.equal(p.delivered[0].title, 'B');
  const st = new P.MemoryTokenStore();
  assert.equal(await P.registerForPush(p, st, { platform: 'ios', deviceId: 'd1' }), 'ExponentPushToken[mock-device-0001]');
  assert.equal(st.rows.size, 1);
  const st2 = new P.MemoryTokenStore();
  assert.equal(await P.registerForPush(new P.MockPushProvider(false), st2, { platform: 'ios', deviceId: 'd1' }), null);
  assert.equal(st2.rows.size, 0);
  assert.equal(P.isValidExpoToken('garbage'), false);
});
test('mock storage: paths, buckets, validation, signed url, remove', async () => {
  const s = new S.MockStorage(), uid = '11111111-2222-3333-4444-555555555555';
  const a = await s.upload({ kind: 'story', type: 'photo', ownerId: uid, bytes: new Uint8Array([1, 2]), id: 'abc' });
  assert.deepEqual(a, { bucket: 'sx-stories', path: `${uid}/story/abc.jpg`, size: 2, contentType: 'image/jpeg' });
  assert.equal(S.BUCKETS.snap, 'snapshotx-media'); assert.equal(S.BUCKETS.memory, 'sx-memories');
  assert.match(await s.signedUrl(a), /^mock:\/\/sx-stories\//);
  await assert.rejects(s.upload({ kind: 'snap', type: 'photo', ownerId: uid, bytes: new Uint8Array() }), /Leeg/);
  await assert.rejects(s.upload({ kind: 'story', type: 'voice', ownerId: uid, bytes: new Uint8Array([1]) }), /spraak/);
  assert.throws(() => S.mediaPath({ kind: 'snap', type: 'photo', ownerId: '../x' }, 'a'));
  assert.equal(await s.remove([a]), 1); await assert.rejects(s.signedUrl(a));
});
test('migration timestamps are unique and ordered', () => {
  const ts = readdirSync(new URL('../supabase/migrations', import.meta.url)).filter(f => f.endsWith('.sql')).map(f => f.slice(0, 14));
  assert.equal(new Set(ts).size, ts.length);
  assert.deepEqual([...ts].sort(), ts);
});
