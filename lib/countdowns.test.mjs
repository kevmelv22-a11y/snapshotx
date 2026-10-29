import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as C from './countdowns.ts';

// Local-time helper so the tests do not depend on the box time zone.
const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 10, 29, 21, 0);
const cd = (id, ms, title = id) => ({ id, title, emoji: '🎉', at: ms, createdAt: NOW - 1000 });

test('remaining splits into days/hours/minutes/seconds and flags done', () => {
  const r = C.remaining(NOW + 2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5000, NOW);
  assert.deepEqual([r.done, r.days, r.hours, r.minutes, r.seconds], [false, 2, 3, 4, 5]);
  assert.equal(C.remaining(NOW - 1, NOW).done, true);
  assert.equal(C.remaining(NOW - 1, NOW).totalMs, 0);
});

test('Dutch labels: dagen/dag/uur/min/Nu!/Afgelopen', () => {
  assert.equal(C.remainingLabel(NOW + 12 * 86400000 + 5, NOW), 'Nog 12 dagen');
  assert.equal(C.remainingLabel(NOW + 86400000 + 5, NOW), 'Nog 1 dag');
  assert.equal(C.remainingLabel(NOW + 5 * 3600000 + 5, NOW), 'Nog 5 uur');
  assert.equal(C.remainingLabel(NOW + 30 * 1000, NOW), 'Nog 1 min');
  assert.equal(C.remainingLabel(NOW - 10 * 60000, NOW), 'Nu!');
  assert.equal(C.remainingLabel(NOW - 2 * 3600000, NOW), 'Afgelopen');
});

test('clock shows days or seconds in the last day', () => {
  assert.equal(C.remainingClock(NOW + 12 * 86400000 + 4 * 3600000 + 9 * 60000, NOW), '12d 04u 09m');
  assert.equal(C.remainingClock(NOW + 4 * 3600000 + 9 * 60000 + 12000, NOW), '04u 09m 12s');
  assert.equal(C.remainingClock(NOW - 5, NOW), '00u 00m 00s');
});

test('sort: upcoming soonest first, finished last; prune drops timers finished > 1 week', () => {
  const list = [cd('late', NOW + 9e8), cd('soon', NOW + 1e6), cd('old', NOW - 8 * 86400000), cd('justdone', NOW - 1000)];
  assert.deepEqual(C.sortCountdowns(list, NOW).map(c => c.id), ['soon', 'late', 'justdone', 'old']);
  assert.deepEqual(C.pruneFinished(list, NOW).map(c => c.id), ['late', 'soon', 'justdone']);
  assert.equal(list.length, 4, 'not mutated');
});

test('parseDutchDateTime accepts dd-mm-jjjj (+ uu:mm) and rejects impossible dates', () => {
  assert.equal(C.parseDutchDateTime('24-12-2026', '20:00'), at(2026, 12, 24, 20, 0));
  assert.equal(C.parseDutchDateTime('1/2/2027'), at(2027, 2, 1));
  assert.equal(C.parseDutchDateTime('01.02.2027', '7.30'), at(2027, 2, 1, 7, 30));
  for (const bad of [['31-02-2027', ''], ['2027-02-01', ''], ['12-13-2027', ''], ['12-12-2027', '24:00'], ['12-12-2027', '9'], ['', '']]) assert.equal(C.parseDutchDateTime(...bad), null, bad.join(' '));
  const f = C.formatDutchDate(at(2026, 12, 24, 20, 5));
  assert.deepEqual(f, { date: '24-12-2026', time: '20:05' });
  assert.equal(C.parseDutchDateTime(f.date, f.time), at(2026, 12, 24, 20, 5), 'round-trips');
});

test('validateDraft: name, rude words, future date, 5-year cap, max 20', () => {
  const ok = C.validateDraft({ title: '  Vakantie   Spanje ', emoji: '🏖️', date: '01-07-2027', time: '' }, NOW);
  assert.deepEqual(ok, { ok: true, value: { title: 'Vakantie Spanje', emoji: '🏖️', at: at(2027, 7, 1) } });
  assert.equal(C.validateDraft({ title: '', emoji: '🎉', date: '01-07-2027', time: '' }, NOW).field, 'title');
  const rude = C.validateDraft({ title: 'kut feest', emoji: '🎉', date: '01-07-2027', time: '' }, NOW);
  assert.equal(rude.ok, false); assert.equal(rude.field, 'title'); assert.match(rude.error, /grof/);
  assert.equal(C.validateDraft({ title: 'Snapshot X launch', emoji: '🎉', date: '01-07-2027', time: '' }, NOW).ok, true, 'reserved-name rule does not apply to timers');
  assert.match(C.validateDraft({ title: 'X', emoji: '🎉', date: '28-10-2026', time: '' }, NOW).error, /toekomst/);
  assert.match(C.validateDraft({ title: 'X', emoji: '🎉', date: '01-01-2040', time: '' }, NOW).error, /5 jaar/);
  assert.match(C.validateDraft({ title: 'X', emoji: '🎉', date: 'morgen', time: '' }, NOW).error, /dd-mm-jjjj/);
  assert.equal(C.validateDraft({ title: 'X', emoji: '', date: '01-07-2027', time: '' }, NOW).value.emoji, '🎉');
  assert.equal(C.validateDraft({ title: 'X', emoji: '🎉', date: '01-07-2027', time: '' }, NOW, C.COUNTDOWN_MAX).field, 'limit');
  assert.equal(C.validateDraft({ title: 'x'.repeat(41), emoji: '🎉', date: '01-07-2027', time: '' }, NOW).field, 'title');
});

test('nextYearly rolls over to next year once the day passed', () => {
  assert.equal(C.nextYearly(24, 12, NOW), at(2026, 12, 24));
  assert.equal(C.nextYearly(1, 3, NOW), at(2027, 3, 1));
  assert.equal(C.nextYearly(29, 10, NOW), at(2027, 10, 29), 'today 00:00 already passed at 21:00');
});

test('profile shows max 3 upcoming timers soonest first; share text is Dutch', () => {
  const list = [cd('a', NOW + 4e8), cd('b', NOW + 1e8), cd('done', NOW - 5), cd('c', NOW + 3e8), cd('d', NOW + 2e8)];
  assert.deepEqual(C.profileTimers(list, NOW).map(t => t.id), ['b', 'd', 'c']);
  assert.equal(C.profileTimers(list, NOW)[0].label, 'Nog 1 dag');
  assert.deepEqual(C.profileTimers([], NOW), []);
  const t = C.shareText({ ...cd('k', at(2026, 12, 24, 20, 0), 'Kerst'), emoji: '🎄' }, NOW);
  assert.equal(t, '🎄 Kerst — nog 55 dagen! (do 24 dec 2026 · 20:00) · via Snapshot X');
  assert.equal(C.whenLabel(at(2027, 1, 1)), 'vr 1 jan 2027');
});

test('wired up: route registered, profile opens the screen (no more "binnenkort"), data stays on device', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /name="countdowns"/);
  const profile = readFileSync(new URL('../app/(tabs)/profile.tsx', import.meta.url), 'utf8');
  assert.match(profile, /onTimers=\{\(\)=>router\.push\('\/countdowns'\)\}/);
  assert.doesNotMatch(profile, /Afteltimers komen binnenkort/);
  const store = readFileSync(new URL('../stores/countdowns.ts', import.meta.url), 'utf8');
  assert.match(store, /AsyncStorage/); assert.doesNotMatch(store, /supabase/);
  const screen = readFileSync(new URL('../app/countdowns.tsx', import.meta.url), 'utf8');
  for (const id of ['countdown-add', 'countdown-save', 'countdown-delete', 'countdown-title', 'countdown-date']) assert.match(screen, new RegExp(`testID="${id}"`));
});
