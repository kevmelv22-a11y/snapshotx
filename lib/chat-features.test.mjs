import assert from 'node:assert/strict';
import test from 'node:test';
import * as F from './chat-features.ts';

const H = 3600000, D = 24 * H;
const T0 = Date.parse('2026-10-13T10:00:00Z');

test('retention: parse defaults to 24h', () => {
  assert.equal(F.parseRetention('keep'), 'keep');
  assert.equal(F.parseRetention('bogus'), '24h');
  assert.equal(F.parseRetention(null), '24h');
});
test('retention: unviewed and kept/saved never expire', () => {
  assert.equal(F.messageExpiry('24h', null), null);
  assert.equal(F.messageExpiry('after_view', null), null);
  assert.equal(F.messageExpiry('keep', T0), null);
  assert.equal(F.messageExpiry('24h', T0, { saved: true }), null);
});
test('retention: 24h after viewing', () => {
  assert.equal(F.messageExpiry('24h', T0), T0 + D);
  assert.equal(F.isMessageVisible('24h', T0, T0 + D - 1), true);
  assert.equal(F.isMessageVisible('24h', T0, T0 + D), false);
});
test('retention: after viewing disappears when chat is left', () => {
  assert.equal(F.isMessageVisible('after_view', T0, T0 + 10 * 60000), true);
  assert.equal(F.isMessageVisible('after_view', T0, T0 + 5000, { leftAt: T0 + 4000 }), false);
  assert.equal(F.isMessageVisible('after_view', T0, T0 + 3000, { leftAt: T0 + 4000 }), true);
});
test('retention hints are Dutch', () => {
  assert.equal(F.retentionHint('24h', T0, T0 + 2 * H), 'Nog 22 u');
  assert.equal(F.retentionHint('24h', T0, T0 + D - 5 * 60000), 'Nog 5 min');
  assert.equal(F.retentionHint('24h', T0, T0 + D), 'Verlopen');
  assert.equal(F.retentionHint('after_view', T0, T0), 'Verdwijnt bij sluiten');
  assert.equal(F.retentionHint('keep', T0, T0), null);
  assert.equal(F.retentionHint('24h', T0, T0, true), 'Bewaard');
  assert.match(F.retentionChangeText('Aria', 'after_view'), /Aria zette chats op: na bekijken/);
});
test('screenshot text and debounce', () => {
  assert.equal(F.screenshotText('Aria', false), 'Aria heeft een screenshot van de chat gemaakt');
  assert.equal(F.screenshotText('Aria', true), 'Je hebt een screenshot van de chat gemaakt');
  assert.equal(F.shouldReportScreenshot(null, T0), true);
  assert.equal(F.shouldReportScreenshot(T0, T0 + 1000), false);
  assert.equal(F.shouldReportScreenshot(T0, T0 + 3000), true);
});

const ev = (who, iso) => ({ senderId: who, at: Date.parse(iso) });
test('streak: counts days where both sent, ending today', () => {
  const e = [ev('a', '2026-10-11T09:00:00Z'), ev('b', '2026-10-11T20:00:00Z'), ev('a', '2026-10-12T09:00:00Z'), ev('b', '2026-10-12T10:00:00Z'), ev('a', '2026-10-13T08:00:00Z'), ev('b', '2026-10-13T09:00:00Z')];
  const s = F.computeStreak(e, 'a', 'b', T0);
  assert.equal(s.count, 3); assert.equal(s.atRisk, false); assert.equal(s.hoursLeft, null);
  assert.equal(F.streakLabel(s), '3🔥');
});
test('streak: one-sided day does not count and breaks the chain', () => {
  const e = [ev('a', '2026-10-10T09:00:00Z'), ev('b', '2026-10-10T09:00:00Z'), ev('a', '2026-10-11T09:00:00Z'), ev('a', '2026-10-12T09:00:00Z'), ev('b', '2026-10-12T09:00:00Z')];
  assert.equal(F.computeStreak(e, 'a', 'b', T0).count, 1);
});
test('streak: yesterday complete, today pending -> alive, hourglass late in day', () => {
  const e = [ev('a', '2026-10-12T09:00:00Z'), ev('b', '2026-10-12T09:00:00Z'), ev('a', '2026-10-13T08:00:00Z')];
  const morning = F.computeStreak(e, 'a', 'b', T0);
  assert.equal(morning.count, 1); assert.equal(morning.atRisk, false); assert.equal(morning.hoursLeft, 14);
  const late = F.computeStreak(e, 'a', 'b', Date.parse('2026-10-13T21:30:00Z'));
  assert.equal(late.atRisk, true); assert.equal(F.streakLabel(late), '1🔥⌛');
  assert.equal(F.streakHint(late), 'Je vriend moet nog vandaag een snap sturen — nog 3 u');
});
test('streak: gap of a full day resets to 0', () => {
  const e = [ev('a', '2026-10-11T09:00:00Z'), ev('b', '2026-10-11T09:00:00Z')];
  const s = F.computeStreak(e, 'a', 'b', T0);
  assert.equal(s.count, 0); assert.equal(F.streakLabel(s), ''); assert.equal(F.streakHint(s), null);
});
test('streak: local day boundary uses the offset (Amsterdam +120)', () => {
  // 22:30Z on 12 Oct is 00:30 on 13 Oct in Amsterdam.
  const e = [ev('a', '2026-10-12T22:30:00Z'), ev('b', '2026-10-13T09:00:00Z')];
  assert.equal(F.computeStreak(e, 'a', 'b', T0, 0).count, 0);
  assert.equal(F.computeStreak(e, 'a', 'b', T0, 120).count, 1);
  assert.equal(F.dayKey(Date.parse('2026-10-12T22:30:00Z'), 120), '2026-10-13');
});
test('streak: ignores third parties', () => {
  const e = [ev('a', '2026-10-13T08:00:00Z'), ev('c', '2026-10-13T08:00:00Z')];
  assert.equal(F.computeStreak(e, 'a', 'b', T0).count, 0);
});

test('typing: throttle, ttl and text', () => {
  assert.equal(F.shouldSendTyping(null, T0, 'h'), true);
  assert.equal(F.shouldSendTyping(null, T0, '  '), false);
  assert.equal(F.shouldSendTyping(T0, T0 + 500, 'hoi'), false);
  assert.equal(F.shouldSendTyping(T0, T0 + 2000, 'hoi'), true);
  let m = F.applyTyping({}, 'b', true, T0);
  m = F.applyTyping(m, 'me', true, T0);
  assert.deepEqual(F.activeTypers(m, T0 + 1000, 'me'), ['b']);
  assert.deepEqual(F.activeTypers(m, T0 + 5000, 'me'), []);
  assert.deepEqual(F.activeTypers(F.applyTyping(m, 'b', false, T0), T0, 'me'), []);
  assert.equal(F.typingText([]), null);
  assert.equal(F.typingText(['Aria']), 'Aria is aan het typen…');
  assert.equal(F.typingText(['Aria', 'Bo']), 'Aria en Bo zijn aan het typen…');
  assert.equal(F.typingText(['a', 'b', 'c']), '3 mensen zijn aan het typen…');
});

test('reactions: toggle, replace, summarize', () => {
  let r = F.toggleReaction([], 'm1', 'me', '❤️');
  assert.deepEqual(r, [{ messageId: 'm1', userId: 'me', emoji: '❤️' }]);
  r = F.toggleReaction(r, 'm1', 'me', '😂');
  assert.equal(r.length, 1); assert.equal(r[0].emoji, '😂');
  r = F.toggleReaction(r, 'm1', 'b', '😂');
  r = F.toggleReaction(r, 'm1', 'c', '🔥');
  r = F.toggleReaction(r, 'm2', 'b', '❤️');
  assert.deepEqual(F.summarizeReactions(r, 'm1', 'me'), [{ emoji: '😂', count: 2, mine: true }, { emoji: '🔥', count: 1, mine: false }]);
  r = F.toggleReaction(r, 'm1', 'me', '😂');
  assert.deepEqual(F.summarizeReactions(r, 'm1', 'me'), [{ emoji: '😂', count: 1, mine: false }, { emoji: '🔥', count: 1, mine: false }]);
  assert.equal(F.REACTION_EMOJIS.length, 7);
});

test('voice: duration, waveform, meter, progress, min length', () => {
  assert.equal(F.formatDuration(0), '0:00');
  assert.equal(F.formatDuration(65400), '1:05');
  assert.equal(F.formatDuration(-5), '0:00');
  const w = F.waveform('abc');
  assert.equal(w.length, 28); assert.deepEqual(w, F.waveform('abc')); assert.notDeepEqual(w, F.waveform('abd'));
  assert.ok(w.every(x => x >= 0.15 && x <= 1));
  assert.equal(F.meterLevel(-160), 0); assert.equal(F.meterLevel(0), 1); assert.equal(F.meterLevel(-30), 0.5); assert.equal(F.meterLevel(undefined), 0);
  assert.equal(F.playbackProgress(500, 1000), 0.5); assert.equal(F.playbackProgress(5, 0), 0); assert.equal(F.playbackProgress(2000, 1000), 1);
  assert.equal(F.keepRecording(300), false); assert.equal(F.keepRecording(1200), true);
});

test('call state machine', () => {
  assert.equal(F.nextCallState('ringing', 'answer'), 'connecting');
  assert.equal(F.nextCallState('ringing', 'connected'), 'ringing');
  assert.equal(F.nextCallState('connecting', 'connected'), 'active');
  assert.equal(F.nextCallState('ringing', 'timeout'), 'ended');
  assert.equal(F.nextCallState('active', 'hangup'), 'ended');
  assert.equal(F.nextCallState('ended', 'answer'), 'ended');
  assert.equal(F.callStatusText('active', 75000), '1:15');
  assert.equal(F.callStatusText('ringing', 0), 'Bellen…');
  assert.equal(F.callStatusText('ended', 0), 'Gesprek beëindigd');
});
