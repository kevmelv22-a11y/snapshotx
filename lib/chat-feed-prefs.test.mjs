import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as F from './chat-feed-prefs.ts';

const rows = [
  { id: 'a', createdAt: '2026-10-22T18:00:00.000Z' },
  { id: 'b', createdAt: '2026-10-22T17:00:00.000Z' },
  { id: 'c', createdAt: '2026-10-22T16:00:00.000Z' },
  { id: 'd', createdAt: null },
];

test('pinned chats go on top in pin order; the rest keep newest-first order; no mutation', () => {
  const prefs = { pins: ['c', 'b'], cleared: {} };
  const copy = JSON.stringify(rows);
  assert.deepEqual(F.arrangeFeed(rows, prefs).map(r => r.id), ['c', 'b', 'a', 'd']);
  assert.equal(JSON.stringify(rows), copy);
  assert.deepEqual(F.arrangeFeed(rows, undefined).map(r => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(F.arrangeFeed(rows, { pins: ['gone', 'b'], cleared: {} }).map(r => r.id), ['b', 'a', 'c', 'd'], 'stale pin ignored');
});

test('togglePin: pin, unpin, max 3 with a Dutch message, pinning un-clears', () => {
  let p = F.EMPTY_FEED;
  for (const id of ['a', 'b', 'c']) { const r = F.togglePin(p, id); assert.equal(r.error, null); p = r.prefs; }
  assert.deepEqual(p.pins, ['a', 'b', 'c']);
  const full = F.togglePin(p, 'd');
  assert.equal(full.error, F.PIN_LIMIT_MESSAGE); assert.equal(full.prefs, p);
  assert.match(F.PIN_LIMIT_MESSAGE, /maximaal 3/);
  p = F.togglePin(p, 'b').prefs; assert.deepEqual(p.pins, ['a', 'c']);
  assert.ok(F.isPinned(p, 'a')); assert.ok(!F.isPinned(p, 'b'));
  const cleared = F.clearFromFeed(F.EMPTY_FEED, 'd', '2026-10-22T19:00:00.000Z');
  assert.deepEqual(F.togglePin(cleared, 'd').prefs, { pins: ['d'], cleared: {} });
});

test('Wissen uit chatfeed hides the chat (and unpins it) until a newer message arrives', () => {
  const p = F.clearFromFeed({ pins: ['b'], cleared: {} }, 'b', '2026-10-22T17:30:00.000Z');
  assert.deepEqual(p.pins, []);
  assert.deepEqual(F.arrangeFeed(rows, p).map(r => r.id), ['a', 'c', 'd']);
  const newer = rows.map(r => r.id === 'b' ? { ...r, createdAt: '2026-10-22T17:31:00.000Z' } : r);
  assert.deepEqual(F.arrangeFeed(newer, p).map(r => r.id), ['a', 'b', 'c', 'd'], 'new message brings it back');
  const empty = F.clearFromFeed(F.EMPTY_FEED, 'd', '2026-10-22T17:30:00.000Z');
  assert.ok(F.isCleared(empty, rows[3]), 'chat without messages stays hidden');
});

test('pruneCleared drops superseded marks only and returns the same object when nothing changed', () => {
  const p = { pins: [], cleared: { a: '2026-10-22T17:00:00.000Z', c: '2026-10-22T17:00:00.000Z' } };
  const next = F.pruneCleared(p, rows);
  assert.deepEqual(next.cleared, { c: '2026-10-22T17:00:00.000Z' });
  assert.equal(F.pruneCleared(next, rows), next);
});

test('chat list wires the long-press Chatinstellingen sheet, pins and clearing', () => {
  const src = readFileSync(new URL('../app/(tabs)/chats.tsx', import.meta.url), 'utf8');
  assert.match(src, /arrangeFeed\(/);
  assert.match(src, /onLongPress=/);
  assert.match(src, /Gesprek vastzetten/);
  assert.match(src, /Wissen uit chatfeed/);
  assert.match(src, /chat-row-pin/);
});
test('feed-cleared toast keeps the subtitle visible on a 390px-wide phone', () => {
  const src = readFileSync(new URL('../app/(tabs)/chats.tsx', import.meta.url), 'utf8');
  assert.match(src, /testID="feed-cleared"/);
  assert.match(src, /gewist uit je chatfeed/);
  assert.match(src, /undoCopy/);
  assert.match(src, /undoSub/);
  // Full-width bar above the compose FAB (not right:98 beside it) so line 2 is not clipped.
  assert.match(src, /right:\s*16/);
  assert.match(src, /bottom:\s*100/);
  assert.doesNotMatch(src, /undoText:[^}]*numberOfLines:\{2\}/);
  assert.doesNotMatch(src, /feed-cleared[\s\S]{0,200}numberOfLines=\{2\}/);
});
