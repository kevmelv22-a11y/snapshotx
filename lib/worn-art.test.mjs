// Worn art (last picked item → its full-body image) + outfit bookkeeping of Outfit.worn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { wornArtKey } from './avatar/worn.ts';
import { applyLook, DEFAULT_FEMALE_OUTFIT, DEFAULT_OUTFIT, parseOutfit, removeLayer, sameOutfit, sanitizeOutfit, wearItem } from './avatar/outfit.ts';
import { WARDROBE_ITEMS, ITEMS_BY_ID } from './avatar/wardrobeItems.ts';

const src = readFileSync(new URL('./wornArt.ts', import.meta.url), 'utf8');
const entries = [...src.matchAll(/'(male|female)\/([a-z0-9-]+)': \{ src: require\('\.\.\/(assets\/[^']+)'\)/g)];
const KEYS = new Set(entries.map(m => `${m[1]}/${m[2]}`));

test('worn map: every entry is a known item with an existing PNG; female has shoes, hats and socks', () => {
  assert.ok(entries.length > 100);
  for (const [, g, id, file] of entries) {
    assert.ok(ITEMS_BY_ID.get(id), `unknown item ${id}`);
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
  }
  for (const c of ['shoes', 'hat', 'socks']) for (const i of WARDROBE_ITEMS.filter(i => i.category === c)) assert.ok(KEYS.has(`female/${i.id}`), `female/${i.id}`);
});

test('tap shows that item, per gender; fallback when off / no art / look applied', () => {
  const male = { ...DEFAULT_OUTFIT, colors: {} };
  for (const id of ['top-bf-skull-tee', 'outer-lacoste-puffer', 'hat-trivo-beanie']) {
    const o = wearItem(male, ITEMS_BY_ID.get(id));
    assert.equal(wornArtKey(o, KEYS), `male/${id}`);
  }
  const fem = wearItem(DEFAULT_FEMALE_OUTFIT, ITEMS_BY_ID.get('bottom-white-cargo'));
  assert.equal(wornArtKey(fem, KEYS), 'female/bottom-white-cargo');
  assert.equal(wornArtKey(wearItem(DEFAULT_FEMALE_OUTFIT, ITEMS_BY_ID.get('shoes-crocs-clog')), KEYS), 'female/shoes-crocs-clog');
  assert.equal(wornArtKey(wearItem(DEFAULT_FEMALE_OUTFIT, ITEMS_BY_ID.get('hat-prada-fedora')), KEYS), 'female/hat-prada-fedora');
  assert.equal(wornArtKey({ ...DEFAULT_FEMALE_OUTFIT, worn: 'shoes-crocs-clog' }, KEYS), null, 'pick no longer worn');
  assert.equal(wornArtKey(removeLayer(fem, 'bottom'), KEYS), null);
  assert.equal(wornArtKey(applyLook(fem, { top: 'top-nike-black-tee' }), KEYS), null);
  assert.equal(sameOutfit(male, wearItem(male, ITEMS_BY_ID.get(male.top))), false, 're-tapping a worn item still updates the doll');
  assert.equal(parseOutfit(JSON.parse(JSON.stringify(fem)), WARDROBE_ITEMS).worn, 'bottom-white-cargo');
  assert.equal(parseOutfit({ ...male, worn: 'top-bf-skull-tee' }, WARDROBE_ITEMS).worn, undefined);
  const paid = WARDROBE_ITEMS.find(i => (i.priceCents ?? 0) > 0 && i.category === 'top');
  assert.equal(sanitizeOutfit(wearItem(male, paid), WARDROBE_ITEMS, [], male).worn, undefined);
});

test('Dutch football jerseys: free tops with worn art for both genders and a thumbnail', () => {
  const thumbs = readFileSync(new URL('../components/avatar/itemArt.ts', import.meta.url), 'utf8');
  for (const id of ['top-psv-jersey', 'top-feyenoord-jersey', 'top-az-jersey', 'top-twente-jersey', 'top-utrecht-jersey']) {
    const it = ITEMS_BY_ID.get(id);
    assert.ok(it && it.category === 'top' && !it.priceCents, id);
    for (const g of ['male', 'female']) assert.equal(wornArtKey(wearItem({ ...(g === 'male' ? DEFAULT_OUTFIT : DEFAULT_FEMALE_OUTFIT), colors: {} }, it), KEYS), `${g}/${id}`);
    assert.ok(thumbs.includes(`'${id}': require('../../assets/avatar-art/items/${id}.png')`), `thumb ${id}`);
    assert.ok(existsSync(new URL(`../assets/avatar-art/items/${id}.png`, import.meta.url)));
  }
});
