import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from './chat-status.ts';

const ME = 'me', ARIA = 'aria', H = 3600000, D = 24 * H;
const at = ms => new Date(ms).toISOString();
const T0 = Date.parse('2026-10-22T10:00:00Z');
const m = (id, sender_id, kind, ago, body = null) => ({ id, sender_id, kind, body, created_at: at(T0 - ago) });
const none = new Set();

test('tone: photo snap red, video snap purple, everything else chat blue', () => {
  assert.equal(S.messageTone({ kind: 'snap', body: 'photo' }), 'snap');
  assert.equal(S.messageTone({ kind: 'snap', body: 'video' }), 'audio');
  for (const kind of ['text', 'photo', 'video', 'voice']) assert.equal(S.messageTone({ kind, body: null }), 'chat');
});

test('my snap: filled arrow Bezorgd until a friend opens it, then outline Geopend', () => {
  const snap = m('1', ME, 'snap', H, 'photo');
  assert.deepEqual(S.messageStatus(snap, ME, false, false), { tone: 'snap', shape: 'arrow', filled: true, label: 'Bezorgd', mine: true, unopened: true });
  const o = S.messageStatus(snap, ME, true, false);
  assert.equal(o.label, 'Geopend'); assert.equal(o.filled, false); assert.equal(o.shape, 'arrow');
});

test('their message: filled square Nieuwe snap / Nieuwe chat, outline Ontvangen once I opened it', () => {
  assert.equal(S.messageStatus(m('1', ARIA, 'snap', H, 'photo'), ME, false, false).label, 'Nieuwe snap');
  assert.equal(S.messageStatus(m('1', ARIA, 'snap', H, 'video'), ME, false, false).tone, 'audio');
  const chat = S.messageStatus(m('2', ARIA, 'text', H, 'hoi'), ME, false, false);
  assert.equal(chat.label, 'Nieuwe chat'); assert.equal(chat.shape, 'square'); assert.ok(chat.filled);
  const read = S.messageStatus(m('2', ARIA, 'text', H, 'hoi'), ME, false, true);
  assert.equal(read.label, 'Ontvangen'); assert.equal(read.filled, false); assert.equal(read.unopened, false);
});

test('thread status: newest message wins, group/retention lines skipped, screenshot shown', () => {
  const list = [m('a', ARIA, 'text', 3 * H, 'hoi'), m('b', ME, 'snap', 2 * H, 'photo'), m('c', ME, 'system', H, 'Kevin zette chats op: 24 uur na bekijken')];
  assert.equal(S.threadStatus(list, ME, none, none).label, 'Bezorgd');
  assert.equal(S.threadStatus(list, ME, new Set(['b']), none).label, 'Geopend');
  const shot = [...list, m('d', ARIA, 'system', 0.5 * H, 'Aria heeft een screenshot van de chat gemaakt')];
  const st = S.threadStatus(shot, ME, none, none);
  assert.equal(st.shape, 'screenshot'); assert.equal(st.label, 'Screenshot!');
  assert.equal(S.threadStatus([m('e', ME, 'system', 0, 'Je hebt een screenshot van de chat gemaakt')], ME, none, none).label, 'Screenshot gemaakt');
});

test('thread status: empty thread is the grey "Tik om te chatten" bubble', () => {
  assert.deepEqual(S.threadStatus([], ME, none, none), S.IDLE_STATUS);
  assert.equal(S.threadStatus([m('x', ME, 'system', 0, 'Kevin voegde Noor toe')], ME, none, none).label, 'Tik om te chatten');
});

test('thread streak: snaps both ways on consecutive days, text does not count, groups have none', () => {
  const list = [];
  for (let d = 1; d <= 5; d++) list.push(m(`a${d}`, ARIA, 'snap', d * D, 'photo'), m(`m${d}`, ME, 'snap', d * D, 'photo'));
  list.push(m('t', ARIA, 'text', 2 * H, 'hoi'));
  assert.equal(S.threadStreak(list, ME, ARIA, T0, 0).count, 5);
  assert.equal(S.threadStreak(list, ME, null, T0, 0).count, 0);
  assert.equal(S.threadStreak(list.filter(x => x.id !== 'm3'), ME, ARIA, T0, 0).count, 2);
});

test('status line: label · time · streak (with ⌛ when at risk)', () => {
  const st = S.messageStatus(m('1', ARIA, 'snap', H), ME, false, false);
  assert.equal(S.statusLine(st, '12 m', { count: 6, atRisk: false, hoursLeft: null, todayMe: false, todayThem: true }), 'Nieuwe snap · 12 m · 6🔥');
  assert.equal(S.statusLine(st, '3 u', { count: 6, atRisk: true, hoursLeft: 2, todayMe: false, todayThem: true }), 'Nieuwe snap · 3 u · 6🔥⌛');
  assert.equal(S.statusLine(st, '', null), 'Nieuwe snap');
  assert.equal(S.statusMeta('5 m', null), '5 m');
});

test('snap line inside a chat', () => {
  const mine = S.messageStatus(m('1', ME, 'snap', H, 'photo'), ME, false, false);
  assert.equal(S.snapLine(mine, false), 'Snap verstuurd · Bezorgd');
  assert.equal(S.snapLine(S.messageStatus(m('1', ME, 'snap', H, 'photo'), ME, true, false), false), 'Snap verstuurd · Geopend');
  const theirs = S.messageStatus(m('2', ARIA, 'snap', H, 'photo'), ME, false, false);
  assert.equal(S.snapLine(theirs, false), 'Tik om snap te bekijken');
  assert.equal(S.snapLine(theirs, true), 'Snap wordt bekeken…');
  const seen = S.messageStatus(m('2', ARIA, 'snap', H, 'photo'), ME, false, true);
  assert.equal(S.snapLine(seen, false), 'Snap geopend · tik om opnieuw te bekijken');
  assert.equal(S.snapLine(seen, false, false), 'Snap geopend');
});

test('day divider: VANDAAG / GISTEREN / weekday / date, in the viewer time zone', () => {
  const now = Date.parse('2026-10-22T04:10:00Z'); // Thu 06:10 in Amsterdam (UTC+2)
  assert.equal(S.dayDivider(Date.parse('2026-10-22T00:30:00Z'), now, 120), 'VANDAAG');
  assert.equal(S.dayDivider(Date.parse('2026-10-21T22:30:00Z'), now, 120), 'VANDAAG'); // 00:30 local on the 22nd
  assert.equal(S.dayDivider(Date.parse('2026-10-21T21:30:00Z'), now, 120), 'GISTEREN'); // 23:30 local on the 21st
  assert.equal(S.dayDivider(Date.parse('2026-10-21T21:30:00Z'), now, 0), 'GISTEREN');
  assert.equal(S.dayDivider(Date.parse('2026-10-19T12:00:00Z'), now, 120), 'MAANDAG');
  assert.equal(S.dayDivider(Date.parse('2026-10-12T12:00:00Z'), now, 120), '12 OKT');
  assert.equal(S.dayDivider(Date.parse('2025-12-31T12:00:00Z'), now, 120), '31 DEC 2025');
});

test('divider starts: first message of each day in a newest-first list', () => {
  const rows = [
    { id: 'c', created_at: '2026-10-22T03:00:00Z' }, { id: 'b', created_at: '2026-10-22T01:00:00Z' },
    { id: 'a', created_at: '2026-10-21T21:30:00Z' }, { id: 'z', created_at: '2026-10-20T10:00:00Z' },
  ];
  // UTC+2: a (23:30 on the 21st) is its own day; b and c share the 22nd -> divider above b (oldest of that day).
  assert.deepEqual([...S.dividerStarts(rows, 120)].sort(), ['a', 'b', 'z']);
  // UTC: a/b/c all on different/same days: c,b on the 22nd, a on the 21st.
  assert.deepEqual([...S.dividerStarts(rows, 0)].sort(), ['a', 'b', 'z']);
  assert.equal(S.dividerStarts([], 0).size, 0);
});
