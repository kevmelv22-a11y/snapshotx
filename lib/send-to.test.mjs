import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { filterFriends, sendSections, RECENT_MAX } from './send-to.ts';

const F = [{ id: 'a', display_name: 'Aria', username: 'aria.nl' }, { id: 'b', display_name: 'Bram', username: 'bram_b' }, { id: 'c', display_name: 'Cleo' }, { id: 'd', display_name: 'Daan', username: 'daantje' }];
test('search matches name or @username', () => {
  assert.deepEqual(filterFriends(F, '@daan').map(f => f.id), ['d']);
  assert.deepEqual(filterFriends(F, 'bram_').map(f => f.id), ['b']);
  assert.deepEqual(filterFriends(F, 'cle').map(f => f.id), ['c']);
});
test('send sheet sections: Beste vrienden by emoji rank, Recent newest first without best friends, A–Z all', () => {
  const act = [{ peerId: 'b', relation: 'best_friend', lastAt: '2026-11-27T10:00:00Z' }, { peerId: 'c', relation: 'bff', lastAt: '2026-11-20T10:00:00Z' }, { peerId: 'd', relation: null, lastAt: '2026-11-27T12:00:00Z' }, { peerId: 'a', relation: 'new_friend', lastAt: '2026-11-26T12:00:00Z' }, { peerId: 'zz', relation: 'bff', lastAt: '2026-11-27T13:00:00Z' }];
  const s = sendSections(F, act, '');
  assert.deepEqual(s.best.map(f => f.id), ['c', 'b'], '💛 BFF before 😊; unknown peers (not friends) ignored');
  assert.deepEqual(s.recent.map(f => f.id), ['d', 'a']);
  assert.deepEqual(s.all.map(f => f.id), ['a', 'b', 'c', 'd']);
  assert.equal(s.search, false);
  const q = sendSections(F, act, 'aria');
  assert.deepEqual([q.best.length, q.recent.length, q.all.map(f => f.id), q.search], [0, 0, ['a'], true]);
  const many = Array.from({ length: 10 }, (_, i) => ({ id: 'f' + i, display_name: 'F' + i }));
  assert.equal(sendSections(many, many.map((f, i) => ({ peerId: f.id, lastAt: `2026-11-${10 + i}T00:00:00Z` })), '').recent.length, RECENT_MAX);
  assert.deepEqual(sendSections(F, [], ''), { best: [], recent: [], all: sendSections(F, [], '').all, search: false });
});
test('compose send sheet renders the sections with real avatars; shared stories sit under Verhalen', async () => {
  const src = await readFile(new URL('../app/compose.tsx', import.meta.url), 'utf8');
  assert.match(src, /testID="send-section-best"/); assert.match(src, /testID="send-section-recent"/);
  assert.match(src, /<FriendAvatar id=\{f\.id\}/);
  assert.ok(src.indexOf('send-shared-story') < src.indexOf('send-section-best'));
});
