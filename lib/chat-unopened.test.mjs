// Snapchat: chats are deleted 24 h after everyone viewed them OR 31 days after sending (unopened chats: 31 days, not 24 h).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as F from './chat-features.ts';
import * as R from './chat-retention.ts';
import * as D from './backend/disappear.ts';
import { forwardExpiry } from './chat-forward.ts';
import { unsaveExpiry } from './chat-saves.ts';

const H = 3600e3, DAY = 24 * H, T0 = Date.parse('2026-10-01T12:00:00Z');
const row = (over = {}) => ({ id: 'm', kind: 'text', body: 'hoi', created_at: new Date(T0).toISOString(), ...over });

test('unopened chats stay 31 days, then go', () => {
  assert.equal(F.UNOPENED_CHAT_TTL_MS, 31 * DAY);
  assert.equal(F.messageExpiry('24h', null, { createdAt: T0 }), T0 + 31 * DAY);
  assert.equal(F.isMessageVisible('24h', null, T0 + 2 * DAY, { createdAt: T0 }), true, 'still there after 2 days unopened');
  assert.equal(F.isMessageVisible('24h', null, T0 + 31 * DAY - 1, { createdAt: T0 }), true);
  assert.equal(F.isMessageVisible('24h', null, T0 + 31 * DAY, { createdAt: T0 }), false);
  assert.equal(F.isMessageVisible('after_view', null, T0 + 31 * DAY, { createdAt: T0 }), false);
  assert.equal(F.messageExpiry('24h', null), null, 'without createdAt the old behaviour (no client expiry) is kept');
});
test('viewed: whichever is sooner (24 h after viewing or 31 days after sending)', () => {
  assert.equal(F.messageExpiry('24h', T0 + H, { createdAt: T0 }), T0 + H + DAY);
  assert.equal(F.messageExpiry('24h', T0 + 30.5 * DAY, { createdAt: T0 }), T0 + 31 * DAY);
  assert.equal(F.messageExpiry('after_view', T0 + H, { createdAt: T0, leftAt: T0 + 2 * H }), T0 + 2 * H);
});
test('Bewaren and saved chats never hit the 31-day cap', () => {
  assert.equal(F.messageExpiry('keep', null, { createdAt: T0 }), null);
  assert.equal(F.messageExpiry('24h', null, { createdAt: T0, saved: true }), null);
  assert.equal(R.isVisibleAsSent(row({ saved: true }), '24h', null, T0 + 400 * DAY, null), true);
  assert.equal(R.isVisibleAsSent(row(), 'keep', null, T0 + 400 * DAY, null), true);
});
test('isVisibleAsSent applies the cap from created_at', () => {
  assert.equal(R.isVisibleAsSent(row(), '24h', null, T0 + 5 * DAY, null), true);
  assert.equal(R.isVisibleAsSent(row(), '24h', null, T0 + 31 * DAY, null), false);
  assert.equal(R.isVisibleAsSent(row({ created_at: 'kapot' }), '24h', null, T0 + 400 * DAY, null), true, 'bad timestamp → no cap');
  assert.equal(R.UNOPENED_NOTE, 'Ongeopende chats worden na 31 dagen verwijderd.');
});
test('server mirrors: cleanup rules, forwarded and unsaved chats', () => {
  const c = { kind: 'chat', createdAt: T0, viewedAt: null, retention: '24h' };
  assert.equal(D.expiresAt(c), T0 + 31 * DAY);
  assert.equal(D.isExpired(c, T0 + DAY + 1), false, 'unopened chat no longer gone after a day');
  assert.equal(D.expiryReason(c), 'chat-unopened-31d');
  assert.equal(D.expiryReason({ ...c, viewedAt: T0 }), 'chat-retention');
  assert.equal(D.expiresAt({ ...c, viewedAt: T0 + 30.9 * DAY }), T0 + 31 * DAY);
  assert.equal(D.expiresAt({ ...c, retention: 'keep' }), null);
  assert.equal(forwardExpiry('24h', T0), new Date(T0 + 31 * DAY).toISOString(), 'forwarded copy: 31 days, not 24 h');
  assert.equal(forwardExpiry('after_view', T0), new Date(T0 + 31 * DAY).toISOString());
  assert.equal(forwardExpiry('keep', T0), null);
  assert.equal(unsaveExpiry('24h', T0 + DAY, { createdAt: T0, openedByAll: false }), new Date(T0 + 31 * DAY).toISOString());
  assert.equal(unsaveExpiry('24h', T0 + DAY, { createdAt: T0, openedByAll: true }), new Date(T0 + 2 * DAY).toISOString());
  assert.equal(unsaveExpiry('24h', T0 + 30.5 * DAY, { createdAt: T0, openedByAll: true }), new Date(T0 + 31 * DAY).toISOString());
  assert.equal(unsaveExpiry('keep', T0, { createdAt: T0, openedByAll: false }), null);
});
test('migration 20261028060000 stamps 31 days, waits for every viewer and is not applied by the app', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261028060000_unopened_chats_31d.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /new\.expires_at := coalesce\(new\.created_at, now\(\)\) \+ interval '31 days'/);
  assert.match(sql, /if pending > 0 then\s+update public\.sx_messages set expires_at = cap/);
  assert.match(sql, /least\(cap, new\.opened_at \+ interval '24 hours'\)/);
  assert.match(sql, /when pending > 0 then cap/);
  assert.doesNotMatch(sql, /greatest\(coalesce\(expires_at/, 'no more first-viewer 24 h timer');
  for (const f of ['app_private.sx_stamp_retention() from public, anon, authenticated', 'app_private.sx_apply_retention() from public, anon, authenticated', 'public.sx_set_message_saved(uuid, boolean) from public, anon'])
    assert.ok(sql.includes(`revoke all on function ${f};`), f);
  assert.match(sql, /security definer set search_path = ''/);
});
test('retention sheet shows the 31-day note (not for Bewaren)', async () => {
  const src = await readFile(new URL('../components/chat/ChatParts.tsx', import.meta.url), 'utf8');
  assert.match(src, /mode!=='keep'&&<Text style=\{s\.optSub\} testID="retention-unopened-note">\{UNOPENED_NOTE\}<\/Text>/);
});
test('demo client mirrors the server: new, forwarded and unsaved chats in a 24 h chat get the 31-day cap', async () => {
  const { DemoClient } = await import('./demo-client.ts');
  const { MOCK_IDS } = await import('./staff-mock.ts');
  const EVA = 'c0000000-0000-4000-8000-0000000000a2', ARIA = 'c0000000-0000-4000-8000-0000000000a1';
  const c = new DemoClient(), ME = MOCK_IDS.owner, msgs = c.m.table('sx_messages');
  await c.rpc('sx_set_retention', { p_thread_id: EVA, p_mode: '24h', p_text: 'Kevin zette chats op: 24 uur na bekijken' });
  const src = msgs.find(m => m.thread_id === ARIA && m.kind === 'text' && !m.body.startsWith('['));
  const t0 = Date.now();
  assert.equal((await c.rpc('sx_forward_message', { p_message_id: src.id, p_thread_ids: [EVA] })).error, null);
  const copy = msgs.filter(m => m.thread_id === EVA && m.forwarded_at).pop();
  const left = Date.parse(copy.expires_at) - t0;
  assert.ok(left > 30.9 * DAY && left <= 31 * DAY + 5000, `forwarded copy lives ~31 days (got ${left / DAY} d)`);
  const sent = await c.from('sx_messages').insert({ thread_id: EVA, sender_id: ME, kind: 'text', body: 'nog niet geopend' }).select().single();
  const mine = msgs.find(m => m.body === 'nog niet geopend');
  assert.ok(sent && mine && mine.retention_mode === '24h' && Math.abs(Date.parse(mine.expires_at) - Date.parse(mine.created_at) - 31 * DAY) < 1000, 'new chat stamped with created + 31 d');
  await c.rpc('sx_set_message_saved', { p_message_id: mine.id, p_saved: true });
  assert.equal(mine.expires_at, null);
  await c.rpc('sx_set_message_saved', { p_message_id: mine.id, p_saved: false });
  assert.ok(Math.abs(Date.parse(mine.expires_at) - Date.parse(mine.created_at) - 31 * DAY) < 1000, 'unsaved while Eva has not opened it → back to 31 days (was 24 h)');
  const kept = msgs.find(m => m.thread_id === ARIA && m.kind === 'text' && m.retention_mode === 'keep' && !m.saved);
  if (kept) assert.equal(kept.expires_at, null, 'Bewaren chats keep no expiry');
});
