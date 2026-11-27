import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { searchMemories } from './memories.ts';

const NOW = Date.parse('2026-11-27T12:00:00Z');
const M = [
  { id: 'a', storage_path: 'a', media_type: 'photo', created_at: '2026-11-27T09:00:00Z', caption: 'Strand met Eva', source: 'story' },
  { id: 'b', storage_path: 'b', media_type: 'video', created_at: '2026-11-03T09:00:00Z', caption: null, source: 'snap' },
  { id: 'c', storage_path: 'c', media_type: 'photo', created_at: '2025-07-14T09:00:00Z', caption: 'Pizza-avond', source: null },
];
const ids = (q, f = 'all') => searchMemories(M, q, f, NOW, 0).map(m => m.id);
test('memories search: caption, month, year, day title, type words, accents/case folded', () => {
  assert.deepEqual(ids(''), ['a', 'b', 'c']);
  assert.deepEqual(ids('strand'), ['a']);
  assert.deepEqual(ids('NOVEMBER'), ['a', 'b']);
  assert.deepEqual(ids('2025'), ['c']);
  assert.deepEqual(ids('vandaag'), ['a']);
  assert.deepEqual(ids('3 november'), ['b']);
  assert.deepEqual(ids('video'), ['b']);
  assert.deepEqual(ids('juli pizza'), ['c']);
  assert.deepEqual(ids('pízza'), ['c']);
  assert.deepEqual(ids('nergens'), []);
});
test('memories filter chips: Snaps (missing source counts as snap), Verhalen, Video\'s', () => {
  assert.deepEqual(ids('', 'snap'), ['b', 'c']);
  assert.deepEqual(ids('', 'story'), ['a']);
  assert.deepEqual(ids('', 'video'), ['b']);
  assert.deepEqual(ids('november', 'snap'), ['b']);
});
test('Herinneringen screen has the search box + chips, loads source, hides Op deze dag while searching', async () => {
  const v = await readFile(new URL('../components/memories/MemoriesView.tsx', import.meta.url), 'utf8');
  assert.match(v, /testID="memories-search"/); assert.match(v, /memories-filter-/);
  assert.match(v, /const flash = searching \? \[\]/);
  const st = await readFile(new URL('./memories-store.ts', import.meta.url), 'utf8');
  assert.match(st, /caption,source'\)/);
});
