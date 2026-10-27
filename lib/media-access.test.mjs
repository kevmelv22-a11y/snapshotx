import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as A from './media-access.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const NOW = Date.parse('2026-10-28T00:00:00Z');
const iso = ms => new Date(NOW + ms).toISOString();
const ME = 'u-me', P = 'u-friend/a.jpg';

test('notExpired: NULL / missing = kept (Bewaren) → readable; past → not; future → yes; garbage → no', () => {
  assert.equal(A.notExpired(null, NOW), true);
  assert.equal(A.notExpired(undefined, NOW), true);
  assert.equal(A.notExpired(iso(60e3), NOW), true);
  assert.equal(A.notExpired(iso(-1), NOW), false);
  assert.equal(A.notExpired(iso(0), NOW), false);
  assert.equal(A.notExpired('nope', NOW), false);
});

test('canReadMedia: kept chat media (expires_at NULL) is readable for the other member — the bug', () => {
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: null }], stories: [], now: NOW }), true);
});

test('legacy rule (before the fix) refuses kept media — reproduces the bug for the demo fault switch', () => {
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: null }], stories: [], now: NOW, legacyNullExpired: true }), false);
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: iso(60e3) }], stories: [], now: NOW, legacyNullExpired: true }), true);
});

test('canReadMedia: expired, removed or unsent media is not readable; own folder always is', () => {
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: iso(-1000) }], stories: [], now: NOW }), false);
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: null, media_deleted_at: iso(-5) }], stories: [], now: NOW }), false);
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [{ media_path: P, expires_at: null, unsent_at: iso(-5) }], stories: [], now: NOW }), false);
  assert.equal(A.canReadMedia({ path: `${ME}/x.jpg`, me: ME, messages: [{ media_path: `${ME}/x.jpg`, expires_at: iso(-1000) }], stories: [], now: NOW }), true);
});

test('canReadMedia: a forwarded copy in a keep chat keeps a shared path readable after the original expired', () => {
  const messages = [{ media_path: P, expires_at: iso(-1000) }, { media_path: P, expires_at: null }];
  assert.equal(A.canReadMedia({ path: P, me: ME, messages, stories: [], now: NOW }), true);
});

test('canReadMedia: stories — owner always, others only while live; unreferenced paths are left to other rules', () => {
  const st = [{ media_path: P, owner_id: 'u-friend', expires_at: iso(-1) }];
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [], stories: st, now: NOW }), false);
  assert.equal(A.canReadMedia({ path: P, me: 'u-friend', messages: [], stories: st, now: NOW }), true);
  assert.equal(A.canReadMedia({ path: P, me: ME, messages: [], stories: [{ ...st[0], expires_at: iso(3600e3) }], now: NOW }), true);
  assert.equal(A.canReadMedia({ path: 'memories/x.jpg', me: ME, messages: [], stories: [], now: NOW }), true);
});

test('demo storage: Eva\'s photo in the Bewaren chat opens; once it expires the demo refuses it like the server', async () => {
  const c = new DemoClient();
  const photo = c.m.table('sx_messages').find(m => m.kind === 'photo' && m.media_path === 'demo/zaterdag.svg' && m.sender_id !== MOCK_IDS.owner);
  assert.ok(photo, 'seeded kept photo');
  assert.equal(photo.expires_at, null);
  const ok = await c.storage.from('snapshotx-media').createSignedUrl('demo/zaterdag.svg', 300);
  assert.equal(ok.error, null);
  assert.ok(ok.data.signedUrl);
  // every message using this path expires → no URL any more
  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(c.m.table('sx_stories').some(s => s.media_path === 'demo/zaterdag.svg'), false, 'only the chat references it');
  for (const m of c.m.table('sx_messages').filter(m => m.media_path === 'demo/zaterdag.svg')) m.expires_at = past;
  const gone = await c.storage.from('snapshotx-media').createSignedUrl('demo/zaterdag.svg', 300);
  assert.equal(gone.data, null);
  assert.equal(gone.error.message, A.MEDIA_ERRORS.gone);
  // memories stay readable
  const mem = await c.storage.from('snapshotx-media').createSignedUrl('demo/zonsondergang.svg', 300);
  assert.equal(mem.error, null);
});

test('migration 20261028000000: storage read policy treats NULL expires_at as kept; keeps all other guards; not the old strict form', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028000000_media_read_kept_chats.sql', import.meta.url), 'utf8');
  const body = sql.slice(sql.indexOf('create policy sx_media_read'));
  assert.match(sql, /drop policy if exists sx_media_read on storage\.objects;/);
  assert.match(body, /\(m\.expires_at is null or m\.expires_at>now\(\)\)/);
  assert.doesNotMatch(body.replace(/\(m\.expires_at is null or m\.expires_at>now\(\)\)/, ''), /m\.expires_at>now\(\)/);
  for (const guard of [/sx_account_active\(\)/, /media_deleted_at is not null/, /sx_is_member\(m\.thread_id\)/, /sx_blocked_with\(m\.sender_id\)/, /interval '90 seconds'/, /s\.expires_at>now\(\)/])
    assert.match(body, guard);
});

test('Media component shows "Niet meer beschikbaar" instead of an endless spinner when no URL can be made', () => {
  const src = readFileSync(new URL('../components/Media.tsx', import.meta.url), 'utf8');
  assert.match(src, /setFailed\(path\)/);
  assert.match(src, /MEDIA_LABEL\.gone/);
  assert.equal(A.MEDIA_LABEL.gone, 'Niet meer beschikbaar');
});
