import assert from 'node:assert/strict';
import test from 'node:test';
import {
  demoViewCount, formatViewCount, lensesForTab, normalizeSearch, parseStoredIds, pickerLenses, pushRecent, searchLenses, toggleFavorite,
} from './lens-picker.ts';
import { PHOTO_FILTERS } from './photo-filters.ts';

const LENSES = pickerLenses(PHOTO_FILTERS);

test('toggleFavorite adds and removes without mutating', () => {
  const start = ['dog'];
  const added = toggleFavorite(start, 'balaclava');
  assert.deepEqual(added, ['dog', 'balaclava']);
  assert.deepEqual(toggleFavorite(added, 'dog'), ['balaclava']);
  assert.deepEqual(start, ['dog']);
});

test('pushRecent puts the latest first, dedupes, caps and ignores Origineel', () => {
  let r = [];
  for (const id of ['dog', 'cat', 'dog', 'warm']) r = pushRecent(r, id);
  assert.deepEqual(r, ['warm', 'dog', 'cat']);
  assert.deepEqual(pushRecent(r, 'original'), r);
  const many = LENSES.map((l) => l.id).reduce((acc, id) => pushRecent(acc, id, 5), []);
  assert.equal(many.length, 5);
  assert.equal(many[0], LENSES.at(-1).id);
});

test('parseStoredIds tolerates garbage, unknown ids and duplicates', () => {
  assert.deepEqual(parseStoredIds('["dog","nope","dog","balaclava"]', LENSES), ['dog', 'balaclava']);
  assert.deepEqual(parseStoredIds('{"a":1}', LENSES), []);
  assert.deepEqual(parseStoredIds('not json', LENSES), []);
  assert.deepEqual(parseStoredIds(null, LENSES), []);
  assert.deepEqual(parseStoredIds('["original"]', LENSES), []);
});

test('search matches name, id and Dutch keywords, accent- and case-insensitive', () => {
  assert.deepEqual(searchLenses('BIVAKMUTS', LENSES).map((l) => l.id), ['balaclava']);
  assert.deepEqual(searchLenses('zónnebril', LENSES).map((l) => l.id), ['sunglasses']);
  assert.ok(searchLenses('dier', LENSES).map((l) => l.id).includes('cat'));
  assert.deepEqual(searchLenses('dier oren', LENSES).map((l) => l.id).sort(), ['dog', 'rabbit']);
  assert.equal(searchLenses('   ', LENSES).length, LENSES.length);
  assert.deepEqual(searchLenses('xyz123', LENSES), []);
  assert.equal(normalizeSearch('  Ëxtra '), 'extra');
});

test('tabs: recent/favourites keep stored order, Uiterlijk = face lenses, Voor jou = all lenses', () => {
  const state = { favorites: ['crown', 'warm'], recent: ['balaclava', 'dog'] };
  assert.deepEqual(lensesForTab('recent', LENSES, state).map((l) => l.id), ['balaclava', 'dog']);
  assert.deepEqual(lensesForTab('favorites', LENSES, state).map((l) => l.id), ['crown', 'warm']);
  assert.ok(lensesForTab('looks', LENSES, state).every((l) => l.kind === 'face'));
  assert.ok(lensesForTab('aesthetic', LENSES, state).every((l) => l.kind !== 'face'));
  assert.equal(lensesForTab('forYou', LENSES, state).length, LENSES.length);
  assert.ok(!LENSES.some((l) => l.id === 'original'));
});

test('demo view counts are deterministic and formatted the Dutch way', () => {
  assert.equal(demoViewCount('balaclava'), demoViewCount('balaclava'));
  for (const l of LENSES) { const n = demoViewCount(l.id); assert.ok(n >= 15e3 && n <= 120e9, l.id); }
  assert.equal(formatViewCount(72e6), '72mln.');
  assert.equal(formatViewCount(6.1e9), '6,1miljard');
  assert.equal(formatViewCount(113e9), '113miljard');
  assert.equal(formatViewCount(15e3), '15K');
  assert.equal(formatViewCount(785e3), '785K');
  assert.equal(formatViewCount(3.7e9), '3,7miljard');
});
