import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from './stories.ts';
const now = Date.parse('2026-10-13T12:00:00Z'), H = 3600_000;
const st = (id, owner, hAgo) => ({ id, owner_id: owner, media_type: 'photo', created_at: new Date(now - hAgo * H).toISOString(), expires_at: new Date(now - hAgo * H + S.STORY_TTL_MS).toISOString() });

test('24h expiry and labels', () => {
  assert.equal(S.isActive(st('a', 'x', 23.9), now), true);
  assert.equal(S.isActive(st('a', 'x', 24), now), false);
  assert.equal(S.timeLeftLabel(st('a', 'x', 20).expires_at, now), 'nog 4 u');
  assert.equal(S.timeLeftLabel(st('a', 'x', 23.95).expires_at, now), 'nog 3 min');
  assert.equal(S.timeLeftLabel(st('a', 'x', 25).expires_at, now), 'verlopen');
  assert.equal(S.ageLabel(st('a', 'x', 2).created_at, now), '2 u geleden');
  assert.equal(S.expiresAtFor(now), new Date(now + 24 * H).toISOString());
});

test('grouping: own first, unseen before seen, expired dropped, oldest first in group', () => {
  const g = S.groupStories([st('1', 'bob', 1), st('2', 'bob', 3), st('3', 'ann', 2), st('4', 'me', 5), st('5', 'old', 30), st('6', 'cee', 0.5)], new Set(['6']), now, 'me');
  assert.deepEqual(g.map(x => x.ownerId), ['me', 'bob', 'ann', 'cee']);
  assert.deepEqual(g[1].stories.map(s => s.id), ['2', '1']);
  assert.equal(S.ringState(g[3]), 'seen');
  assert.equal(S.ringState(g[1]), 'unseen');
  assert.equal(S.ringState(undefined), 'none');
  assert.equal(S.startIndex(g[1].stories, new Set(['2'])), 1);
});

test('navigation across groups', () => {
  const sizes = [2, 1];
  assert.deepEqual(S.next({ group: 0, story: 0 }, sizes), { cursor: { group: 0, story: 1 } });
  assert.deepEqual(S.next({ group: 0, story: 1 }, sizes), { cursor: { group: 1, story: 0 } });
  assert.deepEqual(S.next({ group: 1, story: 0 }, sizes), { close: true });
  assert.deepEqual(S.prev({ group: 1, story: 0 }, sizes), { cursor: { group: 0, story: 1 } });
  assert.deepEqual(S.prev({ group: 0, story: 0 }, sizes), { cursor: { group: 0, story: 0 } });
  assert.equal(S.tapAction(50, 300), 'prev');
  assert.equal(S.tapAction(200, 300), 'next');
  assert.deepEqual(S.switchGroup({ group: 1, story: 0 }, sizes, 1), { close: true });
  assert.deepEqual(S.switchGroup({ group: 1, story: 0 }, sizes, -1), { cursor: { group: 0, story: 0 } });
});

test('swipe classification', () => {
  assert.equal(S.classifySwipe(10, 20), null);
  assert.equal(S.classifySwipe(-100, 10), 'nextGroup');
  assert.equal(S.classifySwipe(100, 10), 'prevGroup');
  assert.equal(S.classifySwipe(5, 120), 'close');
  assert.equal(S.classifySwipe(5, -120), 'reply');
});

test('hold to pause freezes progress', () => {
  let c = S.startClock(0);
  assert.equal(S.progress(c, 1000), 0.2);
  c = S.pauseClock(c, 1000);
  assert.equal(S.progress(c, 4000), 0.2);
  c = S.resumeClock(c, 4000);
  assert.equal(S.progress(c, 5000), 0.4);
  assert.equal(S.progress(c, 99999), 1);
  assert.deepEqual(S.segmentFills(3, 1, 0.5), [1, 0.5, 0]);
});

test('viewers list: dedupe, owner excluded, newest first, emoji joined, cap 200', () => {
  const views = [
    { story_id: 's', viewer_id: 'a', viewed_at: '2026-10-13T10:00:00Z' },
    { story_id: 's', viewer_id: 'b', viewed_at: '2026-10-13T11:00:00Z' },
    { story_id: 's', viewer_id: 'me', viewed_at: '2026-10-13T11:30:00Z' },
    { story_id: 'other', viewer_id: 'c', viewed_at: '2026-10-13T11:00:00Z' },
  ];
  const r = S.viewersFor('s', views, [{ story_id: 's', user_id: 'a', emoji: '🔥' }], 'me');
  assert.equal(r.total, 2);
  assert.deepEqual(r.viewers.map(v => [v.userId, v.emoji]), [['b', null], ['a', '🔥']]);
  const many = Array.from({ length: 250 }, (_, i) => ({ story_id: 's', viewer_id: 'u' + i, viewed_at: new Date(now - i * 1000).toISOString() }));
  const m = S.viewersFor('s', many, [], 'me');
  assert.equal(m.viewers.length, 200); assert.equal(m.total, 250);
  assert.equal(S.viewersLabel(1), '1 kijker'); assert.equal(S.viewersLabel(3), '3 kijkers');
});

test('reply body', () => {
  assert.equal(S.storyReplyBody('   ', null), null);
  assert.equal(S.storyReplyBody(' Mooi! ', 'Strand'), 'Antwoord op je verhaal „Strand”: Mooi!');
  assert.equal(S.storyReplyBody('x'.repeat(600), null).length, 500);
});
