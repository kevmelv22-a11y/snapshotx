import assert from 'node:assert/strict';
import test from 'node:test';
import * as P from './spotlight.ts';
const now = Date.parse('2026-10-13T12:00:00Z');
const it = (id, owner, hAgo, likes, shares = 0) => ({ id, owner_id: owner, created_at: new Date(now - hAgo * 3600_000).toISOString(), likes, shares, views: 0 });

test('formatCount Dutch', () => {
  assert.equal(P.formatCount(999), '999');
  assert.equal(P.formatCount(1000), '1K');
  assert.equal(P.formatCount(1250), '1,2K');
  assert.equal(P.formatCount(12_900), '12K');
  assert.equal(P.formatCount(1_500_000), '1,5 mln');
  assert.equal(P.formatCount(-3), '0');
});
test('ranking uses engagement + decay, drops blocked', () => {
  const r = P.rankFeed([it('old', 'a', 48, 100), it('new', 'b', 1, 10), it('blk', 'x', 0, 999)], now, new Set(['x']));
  assert.deepEqual(r.map(i => i.id), ['new', 'old']);
});
test('like toggle and swipe paging', () => {
  assert.deepEqual(P.toggleLike({ liked: false, likes: 4 }), { liked: true, likes: 5 });
  assert.deepEqual(P.toggleLike({ liked: true, likes: 0 }), { liked: false, likes: 0 });
  assert.equal(P.swipeIndex(0, -100, 3), 1);
  assert.equal(P.swipeIndex(2, -100, 3), 2);
  assert.equal(P.swipeIndex(1, 100, 3), 0);
  assert.equal(P.swipeIndex(1, 30, 3), 1);
  assert.equal(P.pageFromOffset(1450, 700, 5), 2);
  assert.equal(P.pageFromOffset(1e6, 700, 5), 4);
  assert.match(P.shareText('Aria', 'Zon'), /Aria op SnapShot X: Zon/);
});
