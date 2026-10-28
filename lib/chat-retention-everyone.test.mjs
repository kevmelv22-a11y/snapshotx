import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as R from './chat-retention.ts';
import { retentionHint } from './chat-features.ts';
import { DemoClient } from './demo-client.ts';

const NOW = Date.parse('2026-10-28T09:00:00Z'), H = 3600000;
const at = h => new Date(NOW - h * H).toISOString();
const row = (id, sender, h, extra = {}) => ({ id, kind: 'text', body: id, created_at: at(h), sender_id: sender, expires_at: null, ...extra });
const rc = (message_id, user_id, h) => ({ message_id, user_id, opened_at: h === null ? null : at(h) });
const GROUP = ['me', 'aria', 'eva', 'cleo'];

test('everyoneViewedAt: latest first-open of every member except the sender; null while someone has not opened', () => {
  const idx = R.receiptIndex([rc('m', 'me', 27), rc('m', 'aria', 26), rc('m', 'aria', 1), rc('m', 'cleo', null), { message_id: 'x', user_id: 'me', opened_at: 'bad' }]);
  assert.equal(idx.m.aria, NOW - 26 * H, 'first open wins over a later re-open');
  assert.equal(idx.m.cleo, undefined, 'opened_at null is not a view'); assert.equal(idx.x, undefined, 'invalid date skipped');
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.m), null, 'Cleo has not opened → no timer');
  assert.equal(R.everyoneViewedAt('eva', ['me', 'aria', 'eva'], idx.m), NOW - 26 * H, 'without Cleo: last of Kevin (27h) and Aria (26h)');
  assert.equal(R.everyoneViewedAt('me', ['me'], {}), null, 'nobody else → never starts');
  assert.equal(R.everyoneViewedAt('eva', GROUP, undefined), null);
});

test('the bug: in a group a chat YOU read 27 h ago stays while a member still has to open it (Snapchat: 24 h after EVERYONE)', () => {
  const m = row('w', 'eva', 28, { retention_mode: '24h' });
  const ownView = NOW - 27 * H;
  assert.equal(R.isVisibleAsSent(m, '24h', ownView, NOW, null), false, 'old rule (own view) hid it');
  const starts = R.timerStarts([m], GROUP, R.receiptIndex([rc('w', 'me', 27), rc('w', 'aria', 26)]), 'me');
  assert.equal(starts.w, undefined);
  assert.equal(R.isVisibleForEveryone(m, '24h', starts.w ?? null, NOW, NOW - 60000), true, 'new rule keeps it');
  // Cleo opens it now → the 24 h start from her view.
  const s2 = R.timerStarts([m], GROUP, R.receiptIndex([rc('w', 'me', 27), rc('w', 'aria', 26), rc('w', 'cleo', 0)]), 'me');
  assert.equal(s2.w, NOW);
  assert.equal(R.isVisibleForEveryone(m, '24h', s2.w, NOW + 23 * H, NOW), true);
  assert.equal(R.isVisibleForEveryone(m, '24h', s2.w, NOW + 24 * H, NOW), false);
  assert.equal(retentionHint('24h', s2.w, NOW + 5 * H), 'Nog 19 u');
});

test('own chats disappear too, 24 h after everyone viewed them; 31-day cap still applies to unopened ones', () => {
  const mine = row('o', 'me', 26, { retention_mode: '24h' });
  const s = R.timerStarts([mine], GROUP, R.receiptIndex([rc('o', 'aria', 25.9), rc('o', 'eva', 25.5), rc('o', 'cleo', 25)]), 'me');
  assert.equal(s.o, NOW - 25 * H);
  assert.equal(R.isVisibleForEveryone(mine, '24h', s.o, NOW, NOW), false);
  const old = row('u', 'eva', 31 * 24 + 1, { retention_mode: '24h' });
  assert.equal(R.isVisibleForEveryone(old, '24h', null, NOW, NOW), false, 'unopened >31 days → gone');
  assert.equal(R.isVisibleForEveryone(row('k', 'eva', 40 * 24, { retention_mode: 'keep' }), 'keep', NOW - 30 * 24 * H, NOW, NOW), true, 'Bewaren never expires');
  assert.equal(R.isVisibleForEveryone(row('s', 'eva', 30, { retention_mode: '24h', saved: true }), '24h', NOW - 29 * H, NOW, NOW), true, 'saved in chat stays');
  assert.equal(R.isVisibleForEveryone({ ...row('sys', 'x', 50), kind: 'system' }, '24h', NOW - 49 * H, NOW, NOW), true);
});

test('Na bekijken: stays while open; gone once everyone had viewed it before this session; ownViews merge for me', () => {
  const m = row('a', 'eva', 2, { retention_mode: 'after_view' });
  const sessionStart = NOW - 10 * 60000;
  const idx = R.receiptIndex([rc('a', 'aria', 1), rc('a', 'cleo', 1)]);
  assert.equal(R.timerStarts([m], GROUP, idx, 'me').a, undefined, 'Kevin has not opened');
  const s = R.timerStarts([m], GROUP, idx, 'me', { a: NOW - 60000 });
  assert.equal(s.a, NOW - 60000, 'optimistic own receipt completes "everyone"');
  assert.equal(R.isVisibleForEveryone(m, 'after_view', s.a, NOW, sessionStart), true, 'viewed in this session → visible until leaving');
  assert.equal(R.isVisibleForEveryone(m, 'after_view', NOW - H, NOW, sessionStart), false, 'everyone viewed before this session → gone');
  assert.deepEqual(R.timerStarts([{ ...m, kind: 'system' }], GROUP, idx, 'me', { a: NOW }), {}, 'system lines have no timer');
});

test('1-op-1 is unchanged: everyone = the one friend', () => {
  const m = row('p', 'aria', 6, { retention_mode: '24h' });
  const s = R.timerStarts([m], ['me', 'aria'], R.receiptIndex([rc('p', 'me', 5)]), 'me');
  assert.equal(s.p, NOW - 5 * H);
  assert.equal(R.isVisibleForEveryone(m, '24h', s.p, NOW, NOW), true);
  assert.equal(retentionHint('24h', s.p, NOW), 'Nog 19 u');
});

test('demo Festival squad seeds the Snapchat group rule (and matches the server function)', () => {
  const c = new DemoClient(), FEST = 'c0000000-0000-4000-8000-0000000000a4';
  const rows = c.m.table('sx_messages').filter(m => m.thread_id === FEST);
  const members = c.m.table('sx_members').filter(m => m.thread_id === FEST).map(m => m.user_id);
  const me = members.find(u => !rows.some(r => r.sender_id === u && r.kind !== 'system' && /Wie heeft|zonnebrand|Treinkaartjes/.test(String(r.body))) && rows.some(r => r.sender_id === u && /lift/.test(String(r.body))));
  const now = Date.now(), starts = R.timerStarts(rows, members, R.receiptIndex(c.m.table('sx_receipts')), me);
  const vis = rows.filter(r => r.kind !== 'system' && R.isVisibleForEveryone(r, r.retention_mode, starts[r.id] ?? null, now, now)).map(r => r.body);
  assert.deepEqual(vis.sort(), ['Ik neem zonnebrand mee ☀️', 'Treinkaartjes zijn binnen 🚆', 'Wie wil er een lift? 🚗'].sort());
  const counting = rows.find(r => /Treinkaartjes/.test(String(r.body)));
  assert.match(retentionHint('24h', starts[counting.id], now), /^Nog 1[89] u$/);
  const sql = readFileSync(new URL('../supabase/migrations/20261028060000_unopened_chats_31d.sql', import.meta.url), 'utf8');
  assert.match(sql, /mem\.user_id <> m\.sender_id/, 'server also waits for every other member');
});

test('chat screen uses the everyone-viewed timer (not your own view) for chats', () => {
  const src = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /timerStarts\(/); assert.match(src, /isVisibleForEveryone\(/); assert.match(src, /timerStart=\{starts\}/);
  assert.doesNotMatch(src, /rows\.filter\(m=>m\.sender_id===uid\|\|m\.kind==='system'\|\|isVisibleAsSent/, 'own chats no longer always visible');
});
