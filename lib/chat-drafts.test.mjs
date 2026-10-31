import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_MAX, DRAFT_MAX_AGE_MS, draftOf, draftPreview, pruneDrafts, setDraft } from './chat-drafts.ts';

test('setDraft stores, replaces and removes empty drafts', () => {
  let m = setDraft(undefined, 't1', 'Hoi', 1000);
  assert.deepEqual(m, { t1: { text: 'Hoi', at: 1000 } });
  m = setDraft(m, 't1', 'Hoi daar', 2000);
  assert.equal(m.t1.text, 'Hoi daar');
  m = setDraft(m, 't1', '   ', 3000);
  assert.deepEqual(m, {});
  assert.deepEqual(setDraft({}, '', 'x', 1), {});
});

test('pruneDrafts drops old ones and caps the count', () => {
  const now = 100 * 86400e3;
  assert.deepEqual(pruneDrafts({ a: { text: 'x', at: now - DRAFT_MAX_AGE_MS - 1 }, b: { text: 'y', at: now } }, now), { b: { text: 'y', at: now } });
  const many = Object.fromEntries(Array.from({ length: DRAFT_MAX + 5 }, (_, i) => [`t${i}`, { text: 'x', at: now - i }]));
  const kept = pruneDrafts(many, now);
  assert.equal(Object.keys(kept).length, DRAFT_MAX);
  assert.ok(kept.t0 && !kept[`t${DRAFT_MAX + 4}`]);
});

test('draftOf + draftPreview', () => {
  const m = { t: { text: 'Zie je  morgen\nbij het station om acht uur, oké? Neem je fiets mee', at: 10 } };
  assert.equal(draftOf(m, 't', 20), m.t.text);
  assert.equal(draftOf(m, 'x', 20), '');
  assert.equal(draftOf(m, 't', 10 + DRAFT_MAX_AGE_MS + 1), '');
  assert.equal(draftPreview('Kort'), 'Concept: Kort');
  assert.equal(draftPreview(m.t.text, 20), 'Concept: Zie je morgen bij h…');
  assert.equal(draftPreview('  '), '');
});
