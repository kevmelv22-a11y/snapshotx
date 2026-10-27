import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as F from './chat-forward.ts';
import { replyBody } from './chat-replies.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ARIA = 'c0000000-0000-4000-8000-0000000000a1', EVA = 'c0000000-0000-4000-8000-0000000000a2', CREW = 'c0000000-0000-4000-8000-000000000002';

test('canForward: text, stickers and media yes; snaps, polls, system, unsent, expired no', () => {
  const now = Date.parse('2026-10-27T18:00:00Z');
  assert.equal(F.canForward({ kind: 'text', body: 'hoi' }, now), true);
  assert.equal(F.canForward({ kind: 'text', body: '[avatar-sticker:wave]' }, now), true);
  assert.equal(F.canForward({ kind: 'photo', body: null, media_path: 'u/x.jpg' }, now), true);
  assert.equal(F.canForward({ kind: 'voice', body: null, media_path: 'u/x.m4a' }, now), true);
  assert.equal(F.canForward({ kind: 'photo', body: null, media_path: null }, now), false, 'media without file');
  assert.equal(F.canForward({ kind: 'snap', body: 'photo', media_path: 'u/s.jpg', view_once: true }, now), false);
  assert.equal(F.canForward({ kind: 'photo', body: null, media_path: 'u/s.jpg', view_once: true }, now), false);
  assert.equal(F.canForward({ kind: 'system', body: 'screenshot' }, now), false);
  assert.equal(F.canForward({ kind: 'text', body: '[poll]{"q":"?","o":["a","b"]}' }, now), false);
  assert.equal(F.canForward({ kind: 'text', body: 'x', unsent_at: '2026-10-27T17:00:00Z' }, now), false);
  assert.equal(F.canForward({ kind: 'text', body: 'x', expires_at: '2026-10-27T17:59:00Z' }, now), false);
  assert.equal(F.canForward({ kind: 'text', body: 'x', expires_at: '2026-10-27T19:00:00Z' }, now), true);
  assert.equal(F.canForward({ kind: 'text', body: '   ' }, now), false);
});

test('forwardBody drops the quoted-reply prefix; forwardedLabel only for copies', () => {
  const body = replyBody({ id: 'm1', sender_id: 'u1', kind: 'text', body: 'Zaterdag?' }, '  Ja, ik ben er!  ');
  assert.equal(F.forwardBody({ kind: 'text', body }), 'Ja, ik ben er!');
  assert.equal(F.forwardBody({ kind: 'photo', body: null }), null);
  assert.equal(F.forwardedLabel({ forwarded_at: '2026-10-27T18:00:00Z' }), 'Doorgestuurd');
  assert.equal(F.forwardedLabel({}), null);
});

test('forwardTargets: recent chats first without the current one, then friends without a 1-op-1 chat A–Z', () => {
  const chats = [
    { id: 't1', title: 'Aria', isGroup: false, peerIds: ['a'], createdAt: '2026-10-27T10:00:00Z' },
    { id: 't2', title: 'Weekend crew', isGroup: true, peerIds: ['a', 'b'], createdAt: '2026-10-27T12:00:00Z' },
    { id: 'cur', title: 'Eva', isGroup: false, peerIds: ['e'], createdAt: '2026-10-27T13:00:00Z' },
    { id: 'demo-x', title: 'Demo', isGroup: false, peerIds: [], demo: true },
  ];
  const friends = [{ id: 'a', display_name: 'Aria' }, { id: 'z', display_name: 'Zoë' }, { id: 'e', display_name: 'Eva' }, { id: 'm', display_name: 'Milan' }];
  const t = F.forwardTargets(chats, friends, 'cur');
  assert.deepEqual(t.map(x => x.key), ['thread:t2', 'thread:t1', 'friend:m', 'friend:z']);
  assert.deepEqual(t.map(x => x.kind), ['group', 'chat', 'friend', 'friend']);
  assert.equal(t[2].threadId, null); assert.equal(t[2].friendId, 'm');
  assert.deepEqual(F.filterTargets(t, 'zoe').map(x => x.key), ['friend:z'], 'accent-insensitive');
  assert.deepEqual(F.filterTargets(t, '  CREW ').map(x => x.key), ['thread:t2']);
  assert.equal(F.filterTargets(t, '').length, 4);
});

test('toggleTarget / selection summary / done text / validation', () => {
  let r = F.toggleTarget([], 'a'); assert.deepEqual(r, { selected: ['a'], error: null });
  r = F.toggleTarget(r.selected, 'a'); assert.deepEqual(r.selected, []);
  const full = Array.from({ length: F.FORWARD_MAX_TARGETS }, (_, i) => `k${i}`);
  r = F.toggleTarget(full, 'extra'); assert.equal(r.error, F.FORWARD_ERRORS.tooMany); assert.equal(r.selected.length, 10);
  const targets = [
    { key: 'g', kind: 'group', title: 'Weekend crew', peerIds: [], threadId: 'g', friendId: null },
    { key: 'a', kind: 'chat', title: 'Aria Nova', peerIds: ['a'], threadId: 'a', friendId: null },
    { key: 'b', kind: 'friend', title: 'Bo de Vries', peerIds: ['b'], threadId: null, friendId: 'b' },
    { key: 'c', kind: 'friend', title: 'Cleo', peerIds: ['c'], threadId: null, friendId: 'c' },
    { key: 'd', kind: 'friend', title: 'Daan', peerIds: ['d'], threadId: null, friendId: 'd' },
  ];
  assert.equal(F.selectionSummary(targets, ['a', 'g']), 'Aria, Weekend crew');
  assert.equal(F.selectionSummary(targets, ['a', 'g', 'b', 'c', 'd']), 'Aria, Weekend crew, Bo +2');
  assert.equal(F.forwardDoneText(['Aria']), 'Doorgestuurd naar Aria');
  assert.equal(F.forwardDoneText(['Aria', 'Bo', 'Cleo']), 'Doorgestuurd naar 3 chats');
  assert.equal(F.validateSelection([]), F.FORWARD_ERRORS.noTargets);
  assert.equal(F.validateSelection(full), null);
  assert.equal(F.validateSelection([...full, 'x']), F.FORWARD_ERRORS.tooMany);
  assert.equal(F.forwardExpiry('keep', 0), null);
  assert.equal(F.forwardExpiry('24h', 0), new Date(86400000).toISOString());
});

test('demo client sx_forward_message mirrors the migration rules', async () => {
  const c = new DemoClient(), ME = MOCK_IDS.owner, msgs = c.m.table('sx_messages');
  const src = msgs.find(m => m.thread_id === ARIA && m.kind === 'text' && !m.unsent_at && !String(m.body).startsWith('[poll]'));
  assert.ok(src, 'seeded text in the Aria chat');
  const before = msgs.length;
  const r = await c.rpc('sx_forward_message', { p_message_id: src.id, p_thread_ids: [CREW, EVA, CREW] });
  assert.equal(r.error, null); assert.equal(r.data, 2, 'duplicates collapse');
  const copies = msgs.slice(before).filter(m => m.forwarded_at);
  assert.equal(copies.length, 2);
  assert.ok(copies.every(m => m.sender_id === ME && m.body === F.forwardBody(src) && m.view_once === false));
  assert.deepEqual(copies.map(m => m.thread_id).sort(), [CREW, EVA].sort());
  const poll = msgs.find(m => String(m.body).startsWith('[poll]'));
  assert.equal((await c.rpc('sx_forward_message', { p_message_id: poll.id, p_thread_ids: [EVA] })).error.message, F.FORWARD_ERRORS.notForwardable);
  const snap = msgs.find(m => m.kind === 'snap' || m.view_once);
  if (snap) assert.equal((await c.rpc('sx_forward_message', { p_message_id: snap.id, p_thread_ids: [EVA] })).error.message, F.FORWARD_ERRORS.notForwardable);
  assert.equal((await c.rpc('sx_forward_message', { p_message_id: src.id, p_thread_ids: [] })).error.message, F.FORWARD_ERRORS.noTargets);
  assert.equal((await c.rpc('sx_forward_message', { p_message_id: 'nope', p_thread_ids: [EVA] })).error.message, F.FORWARD_ERRORS.notFound);
  assert.equal((await c.rpc('sx_forward_message', { p_message_id: src.id, p_thread_ids: ['c0000000-0000-4000-8000-00000000ffff'] })).error.message, F.FORWARD_ERRORS.notMember);
});

test('migration 20261027180000_chat_forward.sql: same errors, security definer, not granted to anon', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261027180000_chat_forward.sql', import.meta.url), 'utf8');
  for (const msg of Object.values(F.FORWARD_ERRORS).filter(m => m !== F.FORWARD_ERRORS.tooMany)) assert.ok(sql.includes(msg), msg);
  assert.ok(sql.includes('maximaal 10 chats'));
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.sx_forward_message\(uuid, uuid\[\]\) from public, anon/);
  assert.match(sql, /NOT APPLIED/);
});

test('chat screen wires Doorsturen into the long-press menu and the ForwardSheet', () => {
  const src = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /canForward\(item\)/); assert.match(src, /<ForwardSheet/);
  const view = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(view, /msg-forwarded/);
});
