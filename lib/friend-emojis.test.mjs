import assert from 'node:assert/strict';
import test from 'node:test';
import * as F from './friend-emojis.ts';
import { streakLabel } from './chat-features.ts';
import { statusMeta } from './chat-status.ts';

const D = 86400000, NOW = Date.parse('2026-10-23T12:00:00Z'), ME = 'me';
/** n exchanges (friend snap + my snap) per day for the given days ago. */
const ex = (peer, days, perDay = 1, kind = 'snap') => days.flatMap(d => Array.from({ length: perDay }, (_, i) => [
  { peerId: peer, senderId: peer, kind, at: NOW - d * D - i * 60000 }, { peerId: peer, senderId: ME, kind, at: NOW - d * D - i * 60000 + 1000 }]).flat());
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('scores: snaps count double, text single, system ignored; one-way contact does not score', () => {
  const ev = [...ex('a', [1], 1, 'snap'), ...ex('b', [1], 1, 'text'), { peerId: 'c', senderId: 'c', kind: 'snap', at: NOW - D },
    { peerId: 'a', senderId: 'a', kind: 'system', at: NOW - D }];
  const s = F.scores(ev, ME, NOW - 7 * D, NOW + 1);
  assert.equal(s.get('a'), 4); assert.equal(s.get('b'), 2); assert.equal(s.has('c'), false);
});

test('bestFriends: threshold, ranking, ties by newest, max 8', () => {
  const ev = [...ex('a', [1, 2, 3]), ...ex('b', [1, 2]), ...ex('low', [1], 1, 'text')];
  assert.deepEqual(F.bestFriends(ev, ME, NOW - 7 * D, NOW + 1), ['a', 'b']);
  const many = range(1, 10).flatMap(i => ex('p' + i, [1], i));
  const top = F.bestFriends(many, ME, NOW - 7 * D, NOW + 1);
  assert.equal(top.length, F.BEST_FRIENDS_MAX); assert.equal(top[0], 'p10');
  const tie = [...ex('x', [3]), ...ex('y', [1])];
  assert.deepEqual(F.bestFriends(tie, ME, NOW - 7 * D, NOW + 1), ['y', 'x']);
});

test('relationKinds: 💛 #1 now, ❤️ #1 two weeks, 💕 #1 eight weeks, 😊 others, 👶 new friend', () => {
  const bff = F.relationKinds([...ex('a', [1, 2, 3]), ...ex('b', [1])], ME, NOW);
  assert.equal(bff.get('a'), 'bff'); assert.equal(bff.get('b'), 'best_friend');
  const two = F.relationKinds([...ex('a', [1, 2, 9, 10]), ...ex('b', [1])], ME, NOW);
  assert.equal(two.get('a'), 'bffs');
  const eight = F.relationKinds(ex('a', range(0, 8 * 7 - 1).filter(d => d % 3 === 0)), ME, NOW);
  assert.equal(eight.get('a'), 'super_bff');
  const lost = F.relationKinds([...ex('a', [1, 2, 9, 10]), ...ex('b', [8, 9, 10, 11, 12])], ME, NOW);
  assert.equal(lost.get('a'), 'bff', 'someone else was #1 the week before');
  const since = new Map([['n', NOW - 3 * D], ['old', NOW - 30 * D], ['a', NOW - 2 * D]]);
  const k = F.relationKinds([...ex('a', [1, 2]), ...ex('n', [1], 1, 'text')], ME, NOW, since);
  assert.equal(k.get('n'), 'new_friend'); assert.equal(k.has('old'), false); assert.equal(k.get('a'), 'bff', 'best friend beats new friend');
  assert.equal(F.relationKinds([], ME, NOW).size, 0);
});

test('old interactions (> 1 week) do not make a current best friend', () => {
  const k = F.relationKinds(ex('a', [9, 10, 11]), ME, NOW);
  assert.equal(k.has('a'), false);
});

test('custom emoji choices: override, fallback, reset to default removes the key', () => {
  assert.equal(F.emojiFor('bff'), '💛');
  let c = F.setChoice({}, 'bff', '👑'); assert.equal(F.emojiFor('bff', c), '👑');
  c = F.setChoice(c, 'bff', '💛'); assert.deepEqual(c, {});
  c = F.setChoice(c, 'streak', ''); assert.deepEqual(c, {});
  assert.equal(F.emojiFor('streak', { streak: '  ' }), '🔥');
  assert.equal(F.relationLabel('bffs'), "❤️ BFF's");
  assert.equal(F.FRIEND_EMOJI_INFO.length, Object.keys(F.DEFAULT_FRIEND_EMOJIS).length);
  for (const e of Object.values(F.DEFAULT_FRIEND_EMOJIS)) assert.ok(F.EMOJI_CHOICES.includes(e));
});

test('streak glyphs follow the chosen emoji', () => {
  const s = { count: 3, atRisk: true, hoursLeft: 2, todayMe: false, todayThem: true };
  assert.equal(streakLabel(s), '3🔥⌛');
  assert.equal(streakLabel(s, '⚡', '⏳'), '3⚡⏳');
  assert.equal(statusMeta('5 m', s, { fire: '🚀' }), '5 m · 3🚀⌛');
  assert.equal(statusMeta('5 m', s), '5 m · 3🔥⌛');
});
