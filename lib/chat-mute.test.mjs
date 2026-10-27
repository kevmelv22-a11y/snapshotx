import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as M from './chat-mute.ts';

const NOW = Date.parse('2026-10-27T11:00:00.000Z'); // 12:00 Amsterdam (UTC+1)

test('options map to Snapchat-style "Alle meldingen" / "Stil" values', () => {
  assert.deepEqual(M.MUTE_OPTIONS.map(o => o.id), ['off', '1h', '8h', '1w', 'always']);
  assert.equal(M.muteUntil('off', NOW), null);
  assert.equal(M.muteUntil('always', NOW), 'always');
  assert.equal(M.muteUntil('1h', NOW), '2026-10-27T12:00:00.000Z');
  assert.equal(M.muteUntil('8h', NOW), '2026-10-27T19:00:00.000Z');
  assert.equal(M.muteUntil('1w', NOW), '2026-11-03T11:00:00.000Z');
});

test('setMute sets/clears without mutating; isMuted respects the end time', () => {
  const base = { other: 'always' };
  const m = M.setMute(base, 't1', '1h', NOW);
  assert.deepEqual(base, { other: 'always' });
  assert.equal(M.isMuted(m, 't1', NOW), true);
  assert.equal(M.isMuted(m, 't1', NOW + 59 * 60000), true);
  assert.equal(M.isMuted(m, 't1', NOW + 3600000), false, 'ends exactly after 1 hour');
  assert.equal(M.isMuted(m, 'other', NOW + 1e12), true, 'always stays muted');
  assert.equal(M.isMuted(undefined, 't1', NOW), false);
  assert.equal(M.isMuted({ t1: 'garbage' }, 't1', NOW), false);
  const off = M.setMute(m, 't1', 'off', NOW);
  assert.equal('t1' in off, false);
  assert.equal(M.isMuted(off, 't1', NOW), false);
});

test('pruneMutes drops expired timed mutes and keeps identity when unchanged', () => {
  const m = { a: '2026-10-27T10:00:00.000Z', b: 'always', c: '2026-10-28T00:00:00.000Z' };
  assert.deepEqual(M.pruneMutes(m, NOW), { b: 'always', c: '2026-10-28T00:00:00.000Z' });
  const kept = { b: 'always' };
  assert.equal(M.pruneMutes(kept, NOW), kept);
  assert.deepEqual(M.pruneMutes(undefined, NOW), {});
});

test('muteStatus / currentOption labels (Amsterdam time)', () => {
  assert.equal(M.muteStatus({}, 't', NOW), 'Alle meldingen');
  assert.equal(M.muteStatus({ t: 'always' }, 't', NOW), 'Stil');
  assert.equal(M.muteStatus(M.setMute({}, 't', '1h', NOW), 't', NOW), 'Stil tot 13:00');
  assert.match(M.muteStatus(M.setMute({}, 't', '1w', NOW), 't', NOW), /^Stil tot di 3 nov/);
  assert.equal(M.muteStatus({ t: '2026-10-27T10:00:00.000Z' }, 't', NOW), 'Alle meldingen', 'expired');
  assert.equal(M.currentOption({}, 't', NOW), 'off');
  assert.equal(M.currentOption({ t: 'always' }, 't', NOW), 'always');
  assert.equal(M.currentOption(M.setMute({}, 't', '8h', NOW), 't', NOW), 'timed');
});

test('server row mirrors the client value (null muted_until = always)', () => {
  assert.equal(M.muteRow('u', 't', null), null);
  assert.deepEqual(M.muteRow('u', 't', 'always'), { user_id: 'u', thread_id: 't', muted_until: null });
  assert.deepEqual(M.muteRow('u', 't', '2026-10-27T12:00:00.000Z'), { user_id: 'u', thread_id: 't', muted_until: '2026-10-27T12:00:00.000Z' });
});

test('shouldSilencePush reads thread_id (edge payload) or /chat/<id> route (local payload)', () => {
  const m = { t1: 'always' };
  assert.equal(M.shouldSilencePush({ thread_id: 't1' }, m, NOW), true);
  assert.equal(M.shouldSilencePush({ route: '/chat/t1' }, m, NOW), true);
  assert.equal(M.shouldSilencePush({ route: '/chat/t2' }, m, NOW), false);
  assert.equal(M.shouldSilencePush({ route: '/friends' }, m, NOW), false);
  assert.equal(M.shouldSilencePush(null, m, NOW), false);
});

test('wiring: chat list sheet, row icon, store persistence + unapplied migration', () => {
  const ui = readFileSync(new URL('../app/(tabs)/chats.tsx', import.meta.url), 'utf8');
  for (const id of ['chat-settings-mute', 'chat-mute-options', 'chat-row-muted', 'Berichtmeldingen']) assert.ok(ui.includes(id), id);
  const store = readFileSync(new URL('../stores/chatFeed.ts', import.meta.url), 'utf8');
  assert.match(store, /partialize: s => \(\{ byUser: s\.byUser, mutes: s\.mutes \}\)/);
  assert.match(store, /sx_thread_mutes/);
  const sql = readFileSync(new URL('../supabase/migrations/20261027120000_chat_mutes.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /mu\.muted_until is null or mu\.muted_until > now\(\)/);
  assert.match(sql, /sx_blocks/, 'block filter kept');
  assert.match(sql, /sx_push_recipient_deliveries/, 'dedupe kept');
});
