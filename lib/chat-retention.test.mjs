import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as R from './chat-retention.ts';
import { retentionChangeText, retentionHint } from './chat-features.ts';
import { DemoClient } from './demo-client.ts';

const NOW = Date.parse('2026-10-28T03:00:00Z'), H = 3600000;
const at = h => new Date(NOW - h * H).toISOString();
const row = (id, h, extra = {}) => ({ id, kind: 'text', body: id, created_at: at(h), sender_id: 'friend', expires_at: null, ...extra });
const line = (h, text) => ({ id: 'sys' + h, kind: 'system', body: text, created_at: at(h), sender_id: 'x', expires_at: null });

test('retentionFromChangeText parses every line retentionChangeText writes; other lines → null', () => {
  for (const mode of ['after_view', '24h', 'keep']) assert.equal(R.retentionFromChangeText(retentionChangeText('Noor El Amrani', mode)), mode);
  assert.equal(R.retentionFromChangeText('Kevin heeft een screenshot van de chat gemaakt'), null);
  assert.equal(R.retentionFromChangeText(null), null);
});

test('sentModes: stamped mode wins; legacy rows follow the latest change line before them (Snapchat: new setting only going forward)', () => {
  const rows = [row('a', 10), line(8, retentionChangeText('Noor', '24h')), row('b', 6), row('c', 5, { retention_mode: 'keep' }), line(3, retentionChangeText('Kevin', 'keep')), row('d', 1)];
  const m = R.sentModes(rows, 'keep');
  assert.deepEqual(m, { a: '24h', b: '24h', c: 'keep', d: 'keep' }, 'before any line → server default 24h; stamped c stays keep');
  assert.deepEqual(R.sentModes([row('x', 2), row('y', 1)], 'keep'), { x: 'keep', y: 'keep' }, 'never changed → current mode');
  assert.equal(R.modeOf(row('z', 1), {}, 'after_view'), 'after_view');
});

test('the bug: a chat read under 24 h keeps its timer after switching to Bewaren; a kept chat stays when switching away', () => {
  const read = NOW - 4.5 * H;
  const was24 = row('w', 5, { retention_mode: '24h', expires_at: new Date(read + 24 * H).toISOString() });
  const kept = row('k', 1, { retention_mode: 'keep' });
  assert.equal(R.isVisibleAsSent(was24, '24h', read, NOW, null), true);
  assert.equal(R.isVisibleAsSent(was24, '24h', read, read + 24 * H + 1, null), false, 'still vanishes after 24 h even though the chat is now Bewaren');
  assert.equal(retentionHint('24h', read, NOW), 'Nog 19 u', 'the bubble keeps showing its own timer');
  assert.equal(retentionHint('keep', NOW - H, NOW), null);
  assert.equal(R.isVisibleAsSent(kept, 'keep', NOW - 30 * 24 * H, NOW, NOW - H), true, 'kept chat survives a later switch to Na bekijken');
});

test('serverExpired: past expires_at hides unless saved; garbage/NULL never', () => {
  assert.equal(R.serverExpired(row('a', 1, { expires_at: at(0.1) }), NOW), true);
  assert.equal(R.serverExpired(row('a', 1, { expires_at: at(0.1), saved: true }), NOW), false);
  assert.equal(R.serverExpired(row('a', 1, { expires_at: 'nope' }), NOW), false);
  assert.equal(R.serverExpired(row('a', 1), NOW), false);
  assert.equal(R.isVisibleAsSent(row('a', 1, { expires_at: at(0.1) }), 'keep', null, NOW, null), false);
});

test('pendingOldTimers + Dutch texts: only in a Bewaren chat, skips saved / snaps / system lines', () => {
  const rows = [row('a', 5), row('b', 4, { saved: true }), row('c', 3, { kind: 'snap' }), row('d', 1), line(2, 'x')];
  const modes = { a: '24h', b: '24h', c: '24h', d: 'keep' };
  assert.equal(R.pendingOldTimers(rows, modes, 'keep'), 1);
  assert.equal(R.pendingOldTimers(rows, modes, '24h'), 0);
  assert.equal(R.pendingOldTimersText(0), null);
  assert.match(R.pendingOldTimersText(1), /^1 eerdere chat verdwijnt nog volgens de oude instelling\. .*Opslaan in chat/);
  assert.match(R.pendingOldTimersText(3), /^3 eerdere chats verdwijnen/);
  assert.match(R.RETENTION_FORWARD_NOTE, /vanaf nu/);
});

test('demo client stamps new chats with the chat mode (mirror of the trigger) and seeds Noor\'s switched chat', async () => {
  const c = new DemoClient(), msgs = c.m.table('sx_messages');
  const noor = msgs.filter(m => m.thread_id === 'c0000000-0000-4000-8000-0000000000a3');
  const was24 = noor.find(m => String(m.body).startsWith('Stuur je de foto'));
  assert.equal(was24.retention_mode, '24h'); assert.ok(was24.expires_at);
  assert.equal(noor.find(m => String(m.body).startsWith('Top, dan blijft')).retention_mode, 'keep');
  assert.ok(msgs.filter(m => m.kind !== 'system').every(m => ['keep', '24h', 'after_view'].includes(m.retention_mode)), 'all seeds stamped');
  const T = 'c0000000-0000-4000-8000-0000000000a3';
  await c.rpc('sx_set_retention', { p_thread_id: T, p_mode: '24h', p_text: retentionChangeText('Kevin', '24h') });
  const { data } = await c.from('sx_messages').insert({ thread_id: T, sender_id: 'me', kind: 'text', body: 'nieuw', expires_at: null }).select().single();
  assert.equal(data.retention_mode, '24h');
  assert.equal(noor.find(m => String(m.body).startsWith('Top, dan blijft')).retention_mode, 'keep', 'older kept chat untouched');
});

test('migration 20261028030000: column + BEFORE INSERT stamp trigger + per-message mode in sx_apply_retention / unsave', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028030000_message_retention_mode.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column if not exists retention_mode text/);
  assert.match(sql, /create trigger sx_messages_stamp_retention before insert on public\.sx_messages/);
  assert.match(sql, /mode := m\.retention_mode;[\s\S]*create or replace function public\.sx_set_message_saved[\s\S]*mode := m\.retention_mode;/);
  assert.match(sql, /NOT APPLIED/);
});

test('chat screen judges each message by the mode it was sent with and the sheet explains it', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /sentModes\(rows,retention\)/);
  assert.match(chat, /isVisibleAsSent\(m,sentWith\[m\.id\]/);
  assert.doesNotMatch(chat, /isMessageVisible\(retention,/);
  assert.match(chat, /retentionOf=\{m=>sentWith\[m\.id\]\?\?retention\}/);
  const parts = readFileSync(new URL('../components/chat/ChatParts.tsx', import.meta.url), 'utf8');
  assert.match(parts, /RETENTION_FORWARD_NOTE/); assert.match(parts, /retention-old-timers/);
  const view = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(view, /retentionFromChangeText\(item\.body\)\?'⏱':item\.body\?\.includes\('gesprek'\)\?'📹'/, '"bewaart chats in dit gesprek" is a ⏱ line, not a 📹 call line');
});
