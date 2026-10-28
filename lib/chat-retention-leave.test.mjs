import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as R from './chat-retention.ts';
import { retentionHint } from './chat-features.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const NOW = Date.parse('2026-10-28T12:00:00Z'), H = 3600000;
const at = h => new Date(NOW - h * H).toISOString();
const row = (id, sender, h, extra = {}) => ({ id, kind: 'text', body: id, created_at: at(h), sender_id: sender, expires_at: null, retention_mode: '24h', ...extra });
const sys = (id, sender, body, h) => ({ id, kind: 'system', body, created_at: at(h), sender_id: sender, expires_at: null });
const rc = (message_id, user_id, h) => ({ message_id, user_id, opened_at: h === null ? null : at(h) });
const GROUP = ['me', 'aria', 'eva'];

test('leaveEvents: leave lines use the sender, removals resolve the name; unknown names stay null', () => {
  const who = R.nameResolver([{ id: 'noor', name: 'Noor El Amrani' }, { id: 't1', name: 'Tim' }, { id: 't2', name: 'Tim' }]);
  const ev = R.leaveEvents([
    sys('a', 'noor', 'Noor El Amrani heeft de groep verlaten', 3),
    sys('b', 'me', 'Kevin heeft Noor El Amrani uit de groep verwijderd', 2),
    sys('c', 'me', 'Kevin heeft Tim uit de groep verwijderd', 1),
    sys('d', 'me', 'Kevin heeft Onbekend uit de groep verwijderd', 1),
    sys('e', 'me', 'Kevin zette chats op: 24 uur na bekijken', 1),
    row('f', 'me', 1, { body: 'Noor heeft de groep verlaten' }),
  ], who);
  assert.deepEqual(ev, [{ at: NOW - 3 * H, userId: 'noor' }, { at: NOW - 2 * H, userId: 'noor' }, { at: NOW - H, userId: null }, { at: NOW - H, userId: null }], 'ambiguous "Tim" → null; normal chats ignored');
});

test('the bug: a member who never opened the chat leaves → the 24 h starts at the leave, not at the old views', () => {
  const m = row('w', 'me', 30);
  const idx = R.receiptIndex([rc('w', 'aria', 29), rc('w', 'eva', 28)]);
  // While Noor is in the group nobody's timer runs.
  assert.equal(R.timerStarts([m], [...GROUP, 'noor'], idx, 'me').w, undefined);
  // Noor removed 1 min ago. Old behaviour: members shrink → start = 28 h ago → vanished instantly.
  assert.equal(R.timerStarts([m], GROUP, idx, 'me').w, NOW - 28 * H, 'without leave events (old) the start is in the past');
  assert.equal(R.isVisibleForEveryone(m, '24h', NOW - 28 * H, NOW, NOW), false);
  const leaves = [{ at: NOW - 60000, userId: 'noor' }];
  const s = R.timerStarts([m], GROUP, idx, 'me', {}, leaves);
  assert.equal(s.w, NOW - 60000, 'timer starts when Noor left');
  assert.equal(R.isVisibleForEveryone(m, '24h', s.w, NOW, NOW), true);
  assert.equal(retentionHint('24h', s.w, NOW), 'Nog 23 u');
  assert.equal(R.isVisibleForEveryone(m, '24h', s.w, NOW + 24 * H, NOW), false, 'gone 24 h after the leave');
});

test('leavers who HAD viewed count with their view; leaves before sending, by the sender or of current members are ignored', () => {
  const m = row('v', 'eva', 30);
  const idx = R.receiptIndex([rc('v', 'me', 29), rc('v', 'aria', 28), rc('v', 'noor', 27)]);
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.v, NOW - 30 * H, [{ at: NOW - H, userId: 'noor' }]), NOW - 27 * H, 'Noor viewed before leaving');
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.v, NOW - 30 * H, [{ at: NOW - 31 * H, userId: 'tim' }]), NOW - 28 * H, 'left before it was sent');
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.v, NOW - 30 * H, [{ at: NOW - H, userId: 'eva' }]), NOW - 28 * H, 'sender left');
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.v, NOW - 30 * H, [{ at: NOW - H, userId: 'aria' }]), NOW - 28 * H, 'Aria rejoined → normal member rule');
  assert.equal(R.everyoneViewedAt('eva', GROUP, idx.v, NOW - 30 * H, [{ at: NOW - H, userId: null }]), NOW - H, 'unknown leaver → conservative (later)');
  assert.equal(R.everyoneViewedAt('eva', [...GROUP, 'cleo'], idx.v, NOW - 30 * H, [{ at: NOW - H, userId: 'noor' }]), null, 'Cleo still has to open it');
  const ownLater = R.receiptIndex([rc('v', 'me', 0.5), rc('v', 'aria', 28)]);
  assert.equal(R.everyoneViewedAt('eva', GROUP, ownLater.v, NOW - 30 * H, [{ at: NOW - H, userId: 'noor' }]), NOW - 0.5 * H, 'last view after the leave wins');
});

test('chat list: rows that already disappeared are not the preview / unread source', () => {
  const rows = [
    row('gone', 'aria', 30), row('mineGone', 'me', 26), row('wait', 'eva', 28), row('srv', 'aria', 2, { expires_at: at(0.1) }),
    row('kept', 'aria', 50, { retention_mode: 'keep' }), { ...row('snap', 'aria', 40), kind: 'snap' }, sys('s', 'aria', 'Aria zette chats op: 24 uur na bekijken', 60),
    row('av', 'aria', 1, { retention_mode: 'after_view' }),
  ];
  const rcs = [rc('gone', 'me', 29), rc('gone', 'eva', 27), rc('mineGone', 'aria', 25.5), rc('mineGone', 'eva', 25), rc('wait', 'me', 27), rc('av', 'me', 0.5), rc('av', 'eva', 0.4)];
  const vis = R.listVisibleRows(rows, '24h', GROUP, rcs, 'me', NOW).map(r => r.id);
  assert.deepEqual(vis, ['wait', 'kept', 'snap', 's'], '24 h after everyone, server expiry and Na bekijken are gone; kept, snaps and system lines stay');
  // Removal line of the member who never opened "wait" (Aria) → it starts counting, still visible.
  const withLeave = [...rows, sys('rm', 'me', 'Kevin heeft Aria de Vries uit de groep verwijderd', 0.2)];
  const v2 = R.listVisibleRows(withLeave, '24h', ['me', 'eva'], rcs, 'me', NOW, R.nameResolver([{ id: 'aria', name: 'Aria de Vries' }])).map(r => r.id);
  assert.ok(v2.includes('wait'), 'timer starts at the removal → still there');
});

test('demo Weekend crew: removing Noor (never opened) starts the 24 h for the waiting chats, server mirror included', async () => {
  const c = new DemoClient(), CREW = 'c0000000-0000-4000-8000-000000000002', NOOR = '0b000000-0000-4000-8000-000000000016';
  const crew = () => c.m.table('sx_messages').filter(m => m.thread_id === CREW);
  const members = () => c.m.table('sx_members').filter(m => m.thread_id === CREW).map(m => m.user_id);
  const pick = re => crew().find(m => re.test(String(m.body)));
  const ids = [pick(/zaterdag een auto/), pick(/parasol/)];
  const view = (now, leaves) => { const s = R.timerStarts(crew(), members(), R.receiptIndex(c.m.table('sx_receipts')), MOCK_IDS.owner, {}, leaves); return ids.map(m => [s[m.id] ?? null, R.isVisibleForEveryone(m, m.retention_mode, s[m.id] ?? null, now, now)]); };
  let now = Date.now();
  assert.deepEqual(view(now, []), [[null, true], [null, true]], 'waiting for Noor');
  const before = ids.map(m => m.expires_at);
  const r = await c.rpc('sx_remove_group_member', { p_thread_id: CREW, p_user_id: NOOR });
  assert.equal(r.error, null);
  now = Date.now();
  const leaves = R.leaveEvents(crew(), R.nameResolver([{ id: NOOR, name: 'Noor El Amrani' }]));
  assert.equal(leaves.length, 1); assert.equal(leaves[0].userId, NOOR);
  for (const [start, visible] of view(now, leaves)) { assert.ok(start >= now - 5000, 'timer starts at the removal'); assert.equal(visible, true); assert.match(retentionHint('24h', start, now), /^Nog 2[34] u$/); }
  ids.forEach((m, i) => { assert.notEqual(m.expires_at, before[i]); assert.ok(Math.abs(Date.parse(m.expires_at) - (now + 24 * H)) < 5000, 'demo server mirror: expires 24 h after the removal'); });
  // Other crew chats (Bewaren) untouched.
  assert.ok(crew().filter(m => m.retention_mode === 'keep' && m.kind !== 'system').every(m => m.expires_at == null));
});

test('migration file + screens wire the leave rule and the list filter', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028120000_retention_after_leave.sql', import.meta.url), 'utf8');
  assert.match(sql, /after delete on public\.sx_members/); assert.match(sql, /r\.user_id = old\.user_id and r\.opened_at is not null/); assert.match(sql, /interval '31 days'/);
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /leaveEvents\(rows,nameResolver\(/); assert.match(chat, /uid,viewedAt,leaves\)/);
  const list = readFileSync(new URL('./chat-list.ts', import.meta.url), 'utf8');
  assert.match(list, /listVisibleRows\(/); assert.match(list, /for\(const message of visibleMessages\)if\(!latest\.has/);
});

test('demo Festival squad: the newest chat (Na bekijken, seen by all) is gone, so the list row uses the "lift" chat', () => {
  const c = new DemoClient(), FEST = 'c0000000-0000-4000-8000-0000000000a4';
  const rows = c.m.table('sx_messages').filter(m => m.thread_id === FEST).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  assert.match(String(rows[0].body), /Zie je zo/, 'raw newest = the vanished chat');
  const members = c.m.table('sx_members').filter(m => m.thread_id === FEST).map(m => m.user_id);
  const vis = R.listVisibleRows(rows, '24h', members, c.m.table('sx_receipts'), MOCK_IDS.owner, Date.now());
  assert.match(String(vis.find(r => r.kind !== 'system').body), /lift/);
});
