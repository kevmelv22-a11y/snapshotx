import test from 'node:test';
import assert from 'node:assert/strict';
import { hitLabel, searchChat, searchableText, stepHit } from './chat-search.ts';
import { replyBody } from './chat-replies.ts';
import { pollBody } from './chat-polls.ts';

const rows = [
  { id: 'm5', kind: 'text', body: 'Zullen we naar het café?' },
  { id: 'm4', kind: 'snap', body: 'photo' },
  { id: 'm3', kind: 'system', body: 'Noor zette chats op 24 uur' },
  { id: 'm2', kind: 'text', body: 'Cafe De Jaren om 8 uur', unsent_at: null },
  { id: 'm1', kind: 'text', body: 'verwijderd café', unsent_at: '2026-10-31T10:00:00Z' },
];

test('searchChat: accent/case-insensitive, skips snaps/system/unsent, newest first', () => {
  assert.deepEqual(searchChat(rows, 'CAFE'), ['m5', 'm2']);
  assert.deepEqual(searchChat(rows, 'uur'), ['m2']);
  assert.deepEqual(searchChat(rows, 'c'), []);
  assert.deepEqual(searchChat(rows, '  '), []);
});

test('searchableText: replies without the quote prefix, polls by question + answers', () => {
  const reply = replyBody({ id: 'x', sender_id: 's', kind: 'text', body: 'origineel bericht' }, 'mijn antwoord');
  assert.equal(searchableText({ id: 'r', kind: 'text', body: reply }), 'mijn antwoord');
  const p = pollBody('Waar eten we?', ['Pizza', 'Sushi']);
  assert.ok(p.ok);
  assert.equal(searchableText({ id: 'p', kind: 'text', body: p.body }), 'Waar eten we? Pizza Sushi');
});

test('stepHit + hitLabel', () => {
  assert.equal(stepHit(3, -1, 'older'), 0);
  assert.equal(stepHit(3, 0, 'older'), 1);
  assert.equal(stepHit(3, 2, 'older'), 0);
  assert.equal(stepHit(3, 0, 'newer'), 2);
  assert.equal(stepHit(0, 0, 'older'), -1);
  assert.equal(hitLabel(5, 1, 'ca'), '2 van 5');
  assert.equal(hitLabel(0, -1, 'xyz'), 'Geen resultaten');
  assert.equal(hitLabel(0, -1, 'x'), '');
});
