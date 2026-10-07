import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OUTFIT, formatPriceCents, isOwned, itemsForTab, parseOutfit, pushHistory, recolor, redoHistory,
  removeLayer, sanitizeOutfit, startHistory, undoHistory, wearItem,
} from './avatar/outfit.ts';

const items = [
  { id: 'robe', category: 'outerwear', brand: 'Paramount', name: 'Emperor Robe', priceCents: 200, colors: ['#FFFFFF'], preview: { variant: 'cape' } },
  { id: 'rose', category: 'outerwear', brand: 'Bitmoji Fashion', name: 'Grunge Rose Zip-up Hoodie', priceCents: 29, colors: ['#FFFFFF'], preview: { variant: 'zip' } },
  { id: 'outer-nike-swoosh-hoodie', category: 'outerwear', brand: 'Nike', name: 'Hoodie', priceCents: null, colors: ['#000000'], preview: { variant: 'hoodie' }, featured: true },
  { id: 'top-blueberry-white-tee', category: 'top', brand: 'blueberry', name: 'Tee', priceCents: null, colors: ['#FFFFFF'], preview: { variant: 'tee' } },
  { id: 'gown', category: 'dress', brand: 'Festive Fashion', name: 'Gown', priceCents: 199, colors: ['#FF0000'], preview: { variant: 'gown' } },
];

test('nl-NL price formatting', () => {
  assert.equal(formatPriceCents(200), '€ 2,00');
  assert.equal(formatPriceCents(29), '€ 0,29');
  assert.equal(formatPriceCents(123456), '€ 1.234,56');
});

test('wearing items replaces the layer, resets its colour and keeps dress/top exclusive', () => {
  let o = recolor(DEFAULT_OUTFIT, 'outerwear', '#F9D3DA');
  o = wearItem(o, items[0]);
  assert.equal(o.outerwear, 'robe');
  assert.equal(o.colors.outerwear, undefined);
  o = wearItem(o, items[4]);
  assert.equal(o.dress, 'gown');
  assert.equal(o.top, DEFAULT_OUTFIT.top, 'top is kept underneath a dress');
  o = wearItem(o, items[3]);
  assert.equal(o.dress, null);
  assert.equal(removeLayer(o, 'outerwear').outerwear, null);
});

test('undo / redo walk the outfit history', () => {
  let h = startHistory(DEFAULT_OUTFIT);
  h = pushHistory(h, wearItem(h.present, items[0]));
  h = pushHistory(h, recolor(h.present, 'outerwear', '#1C1C1E'));
  assert.equal(h.past.length, 2);
  h = undoHistory(h);
  assert.equal(h.present.colors.outerwear, undefined);
  h = undoHistory(h);
  assert.equal(h.present.outerwear, DEFAULT_OUTFIT.outerwear);
  h = redoHistory(h);
  assert.equal(h.present.outerwear, 'robe');
  assert.equal(pushHistory(h, h.present), h, 'no-op changes are not recorded');
});

test('saving strips unowned paid items; unlocking keeps them', () => {
  const draft = wearItem(DEFAULT_OUTFIT, items[0]);
  assert.equal(sanitizeOutfit(draft, items, [], DEFAULT_OUTFIT).outerwear, DEFAULT_OUTFIT.outerwear);
  assert.equal(sanitizeOutfit(draft, items, ['robe'], DEFAULT_OUTFIT).outerwear, 'robe');
  assert.equal(isOwned(items[1], []), false);
  assert.equal(isOwned(items[2], []), true);
});

test('stored outfits are validated', () => {
  const parsed = parseOutfit({ outerwear: 'rose', top: 'gown', colors: { hair: '#123456', top: 'red' } }, items);
  assert.equal(parsed.outerwear, 'rose');
  assert.equal(parsed.top, DEFAULT_OUTFIT.top, 'wrong-category id falls back');
  assert.deepEqual(parsed.colors, { hair: '#123456' });
  assert.deepEqual(parseOutfit(null, items).top, DEFAULT_OUTFIT.top);
});

test('grid tabs, free filter and sorting', () => {
  assert.deepEqual(itemsForTab(items, 'featured').map(i => i.id), ['outer-nike-swoosh-hoodie']);
  assert.deepEqual(itemsForTab(items, 'outerwear', { onlyFree: true }).map(i => i.id), ['outer-nike-swoosh-hoodie']);
  assert.deepEqual(itemsForTab(items, 'outerwear', { sort: 'price' }).map(i => i.id), ['outer-nike-swoosh-hoodie', 'rose', 'robe']);
  assert.deepEqual(itemsForTab(items, 'outerwear', { sort: 'name' }).map(i => i.name), ['Emperor Robe', 'Grunge Rose Zip-up Hoodie', 'Hoodie']);
});
