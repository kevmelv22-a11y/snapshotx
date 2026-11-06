import assert from 'node:assert/strict';
import test from 'node:test';
import { STORY_DELETE_TEXT, isStoryActive, storyDeletePatch } from './story-delete.ts';

test('story delete copy + patch', () => {
  assert.equal(STORY_DELETE_TEXT.confirm, 'Verwijderen');
  const p = storyDeletePatch(new Date('2026-11-06T20:00:00.000Z'));
  assert.equal(p.removed_at, '2026-11-06T20:00:00.000Z');
  assert.equal(p.expires_at, p.removed_at);
});

test('isStoryActive hides removed and expired', () => {
  const now = Date.parse('2026-11-06T20:00:00Z');
  assert.equal(isStoryActive({ expires_at: '2026-11-07T00:00:00Z' }, now), true);
  assert.equal(isStoryActive({ expires_at: '2026-11-05T00:00:00Z' }, now), false);
  assert.equal(isStoryActive({ expires_at: '2026-11-07T00:00:00Z', removed_at: '2026-11-06T19:00:00Z' }, now), false);
  assert.equal(isStoryActive({ expires_at: null }, now), false);
});
