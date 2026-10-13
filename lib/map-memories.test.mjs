import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const P = await import('./map-privacy.ts');
const M = await import('./memories.ts');
const NOW = Date.parse('2026-10-13T12:00:00Z'), H = 3600000;

test('ghost mode timed options and until-off', () => {
  const base = {...P.DEFAULT_PRIVACY, audience: 'all'};
  const g3 = P.enableGhost(base, '3h', NOW);
  assert.equal(P.isGhost(g3, NOW + 2.9 * H), true);
  assert.equal(P.isGhost(g3, NOW + 3 * H + 1), false);
  assert.equal(P.ghostStatusText(g3, NOW + H), 'Spookmodus · nog 2 u');
  assert.equal(P.ghostStatusText(g3, NOW + 2 * H + 45 * 60000), 'Spookmodus · nog 15 min');
  const g24 = P.enableGhost(base, '24h', NOW);
  assert.equal(P.isGhost(g24, NOW + 23 * H), true);
  const gf = P.enableGhost(base, 'until_off', NOW);
  assert.equal(P.isGhost(gf, NOW + 1000 * H), true);
  assert.equal(P.isGhost(P.disableGhost(gf), NOW), false);
  assert.equal(P.ghostStatusText(base, NOW), 'Spookmodus uit');
});

test('audience: all / selected / none and ghost overrides', () => {
  let p = {...P.DEFAULT_PRIVACY, audience: 'selected'};
  assert.equal(P.canFriendSee(p, 'a', NOW), false);
  p = P.toggleAllowed(p, 'a');
  assert.equal(P.canFriendSee(p, 'a', NOW), true);
  assert.equal(P.canFriendSee(p, 'b', NOW), false);
  assert.equal(P.sharingSummary(p, NOW), 'Zichtbaar voor 1 vriend');
  assert.deepEqual(P.toggleAllowed(p, 'a').allowedIds, []);
  assert.equal(P.canFriendSee({...p, audience: 'all'}, 'b', NOW), true);
  assert.equal(P.canFriendSee({...p, audience: 'none'}, 'a', NOW), false);
  assert.equal(P.canFriendSee(P.enableGhost({...p, audience: 'all'}, '3h', NOW), 'a', NOW), false);
  assert.equal(P.isSharing({...P.DEFAULT_PRIVACY, audience: 'selected'}, NOW), false);
});

test('row mapping and legacy fallback', () => {
  assert.equal(P.privacyFromRow({sharing: true}).audience, 'all');
  assert.equal(P.privacyFromRow({sharing: false}).audience, 'none');
  assert.equal(P.privacyFromRow(null).audience, 'none');
  const row = P.privacyToRow(P.enableGhost({...P.DEFAULT_PRIVACY, audience: 'all'}, 'until_off', NOW));
  assert.deepEqual(row, {ghost_until: null, ghost_forever: true, share_audience: 'all', sharing: true});
  assert.equal(P.privacyToRow({...P.DEFAULT_PRIVACY}).sharing, false);
});

test('last seen texts', () => {
  const ago = ms => new Date(NOW - ms).toISOString();
  assert.equal(P.lastSeenText(ago(30000), NOW), 'Nu');
  assert.equal(P.lastSeenText(ago(5 * 60000), NOW), '5 min geleden');
  assert.equal(P.lastSeenText(ago(3 * H), NOW), '3 u geleden');
  assert.equal(P.lastSeenText(ago(30 * H), NOW), 'Gisteren');
  assert.equal(P.lastSeenText(ago(80 * H), NOW), '3 dagen geleden');
  assert.equal(P.lastSeenText(ago(-5000), NOW), 'Nu');
  assert.equal(P.isLive(ago(10 * 60000), NOW), true);
  assert.equal(P.isLive(ago(20 * 60000), NOW), false);
});

const mem = (id, iso, extra = {}) => ({id, storage_path: `p/${id}`, media_type: 'photo', created_at: iso, ...extra});
test('grouping by date with Dutch titles, timezone and private filter', () => {
  const items = [mem('a', '2026-10-13T08:00:00Z'), mem('b', '2026-10-12T23:30:00Z'), mem('c', '2026-10-11T10:00:00Z'), mem('d', '2025-03-02T10:00:00Z'), mem('e', '2026-10-13T09:00:00Z', {private: true})];
  const s = M.groupByDate(items, NOW, {tzOffsetMin: -120});
  assert.deepEqual(s.map(x => x.title), ['Vandaag', '11 oktober', '2 maart 2025']);
  assert.deepEqual(s[0].items.map(x => x.id), ['a', 'b']); // 23:30Z = 01:30 local on the 13th
  assert.equal(M.groupByDate(items, NOW, {tzOffsetMin: 0})[1].title, 'Gisteren');
  assert.equal(M.groupByDate(items, NOW, {includePrivate: true, tzOffsetMin: -120})[0].items.length, 3);
});

test('on this day: earlier years only, never private', () => {
  const items = [mem('a', '2025-10-13T10:00:00Z'), mem('b', '2023-10-13T10:00:00Z'), mem('c', '2024-10-13T10:00:00Z', {private: true}), mem('d', '2026-10-13T10:00:00Z'), mem('e', '2025-10-14T10:00:00Z')];
  const f = M.onThisDay(items, NOW);
  assert.deepEqual(f.map(x => [x.yearsAgo, x.items.map(i => i.id)]), [[1, ['a']], [3, ['b']]]);
  assert.equal(M.flashbackTitle(1), 'Op deze dag · 1 jaar geleden');
});

test('PIN validation, hashing and lockout', async () => {
  assert.match(M.validatePin('12a4'), /cijfers/);
  assert.match(M.validatePin('123'), /4 cijfers/);
  assert.match(M.validatePin('1111'), /voorspelbare/);
  assert.match(M.validatePin('4321'), /voorspelbare/);
  assert.equal(M.validatePin('2580'), null);
  const dig = async s => createHash('sha256').update(s).digest('hex');
  const h1 = await M.hashPin('2580', 'salt', dig);
  assert.equal(h1, await M.hashPin('2580', 'salt', dig));
  assert.notEqual(h1, await M.hashPin('2580', 'other', dig));
  assert.notEqual(h1, await M.hashPin('2581', 'salt', dig));
  let l = {failures: 0, lockedUntil: null};
  for (let i = 0; i < 4; i++) l = M.registerPinAttempt(l, false, NOW);
  assert.equal(M.isLocked(l, NOW), false);
  assert.equal(M.lockText(l, NOW), 'Onjuiste pincode. Nog 1 pogingen.');
  l = M.registerPinAttempt(l, false, NOW);
  assert.equal(M.isLocked(l, NOW + 29000), true);
  assert.equal(M.isLocked(l, NOW + 31000), false);
  l = M.registerPinAttempt(l, false, NOW);
  assert.equal(l.lockedUntil, NOW + 60000);
  assert.deepEqual(M.registerPinAttempt(l, true, NOW), {failures: 0, lockedUntil: null});
});

test('save and re-send payloads', () => {
  assert.deepEqual(M.memoryInsert('u', 'p/x', 'video', ''), {owner_id: 'u', storage_path: 'p/x', media_type: 'video', caption: null, source: 'snap', private: false});
  const rows = M.resendMessages(mem('a', '2025-10-13T10:00:00Z', {caption: 'Hoi'}), 'u', ['t1', 't2', 't1'], NOW);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {thread_id: 't1', sender_id: 'u', kind: 'snap', body: 'Hoi', media_path: 'p/a', expires_at: '2026-10-14T12:00:00.000Z'});
  assert.equal(M.togglePrivate([mem('a', '2025-01-01T00:00:00Z')], 'a', true)[0].private, true);
});
