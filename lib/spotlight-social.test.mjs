import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from './spotlight-social.ts';
const now = Date.parse('2026-10-22T16:00:00Z');
const at = min => new Date(now - min * 60000).toISOString();
const c = (id, user, min, story = 's1', body = 'hoi') => ({ id, story_id: story, user_id: user, body, created_at: at(min) });

test('normalizeComment trims, collapses and caps at 150 characters (emoji = 1)', () => {
  assert.equal(S.normalizeComment('   '), null);
  assert.equal(S.normalizeComment('  Mooi \n\n plaatje  '), 'Mooi plaatje');
  assert.equal(Array.from(S.normalizeComment('😀'.repeat(200))).length, 150);
  assert.equal(S.charsLeft('😀😀'), 148);
});
test('titles and ages', () => {
  assert.equal(S.commentsTitle(0), 'Nog geen reacties');
  assert.equal(S.commentsTitle(1), '1 reactie');
  assert.equal(S.commentsTitle(7), '7 reacties');
  assert.equal(S.commentAge(at(0.2), now), 'Nu');
  assert.equal(S.commentAge(at(5), now), '5 min');
  assert.equal(S.commentAge(at(125), now), '2 u');
  assert.equal(S.commentAge(at(3 * 1440), now), '3 d');
  assert.equal(S.commentAge(at(15 * 1440), now), '2 w');
});
test('thread: my fresh comment pinned, then most liked, then newest; blocked hidden; other snaps excluded', () => {
  const list = [c('a', 'u1', 300), c('b', 'u2', 200), c('mine', 'me', 1), c('old-mine', 'me', 600), c('x', 'blk', 5), c('other', 'u1', 1, 's2')];
  const likes = [{ comment_id: 'a', user_id: 'u2' }, { comment_id: 'a', user_id: 'me' }, { comment_id: 'b', user_id: 'u1' }, { comment_id: 'a', user_id: 'u3' }];
  const t = S.commentThread(list, likes, 's1', 'me', now, new Set(['blk']));
  assert.deepEqual(t.map(x => x.id), ['mine', 'a', 'b', 'old-mine']);
  assert.equal(t[0].pinned, true); assert.equal(t[3].pinned, false); assert.equal(t[3].mine, true);
  assert.deepEqual([t[1].likes, t[1].liked, t[2].likes, t[2].liked], [3, true, 1, false]);
  assert.equal(S.commentCount(list, 's1', new Set(['blk'])), 4);
});
test('comment likes toggle and delete rights', () => {
  let l = S.toggleCommentLike([], 'a', 'me');
  assert.deepEqual(l, [{ comment_id: 'a', user_id: 'me' }]);
  l = S.toggleCommentLike([...l, { comment_id: 'a', user_id: 'u2' }], 'a', 'me');
  assert.deepEqual(l, [{ comment_id: 'a', user_id: 'u2' }]);
  assert.equal(S.canDeleteComment(c('a', 'me', 1), 'me', 'owner'), true);
  assert.equal(S.canDeleteComment(c('a', 'u1', 1), 'me', 'me'), true);
  assert.equal(S.canDeleteComment(c('a', 'u1', 1), 'me', 'owner'), false);
});
test('subscribe', () => {
  assert.equal(S.subscribeLabel(false), 'Abonneren');
  assert.equal(S.subscribeLabel(true), 'Geabonneerd');
  assert.equal(S.canSubscribe('me', 'me'), false);
  assert.equal(S.canSubscribe('aria', 'me'), true);
  const s1 = S.toggleSubscription(new Set(), 'aria');
  assert.equal(s1.has('aria'), true);
  assert.equal(S.toggleSubscription(s1, 'aria').has('aria'), false);
  assert.equal(s1.has('aria'), true, 'immutable');
  assert.equal(S.subscriberText(1), '1 abonnee');
  assert.equal(S.subscriberText(1200, n => '1,2K'), '1,2K abonnees');
});
test('double tap only likes', () => {
  assert.equal(S.isDoubleTap(null, 1000), false);
  assert.equal(S.isDoubleTap(800, 1000), true);
  assert.equal(S.isDoubleTap(600, 1000), false);
  assert.deepEqual(S.likeOnDoubleTap({ liked: false, likes: 4 }), { liked: true, likes: 5, changed: true });
  assert.deepEqual(S.likeOnDoubleTap({ liked: true, likes: 5 }), { liked: true, likes: 5, changed: false });
});
test('live subscriber count follows my toggle', () => {
  assert.equal(S.liveSubscribers(10, false, true), 11);
  assert.equal(S.liveSubscribers(10, true, false), 9);
  assert.equal(S.liveSubscribers(10, true, true), 10);
  assert.equal(S.liveSubscribers(0, true, false), 0);
});
