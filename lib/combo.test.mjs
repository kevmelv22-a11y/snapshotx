// Composite doll layer selection (lib/avatar/combo.ts) on the generated band info.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboLayers, comboId } from './avatar/combo.ts';
import { WORN_BANDS } from './avatar/wornBandInfo.ts';
import { DEFAULT_FEMALE_OUTFIT, DEFAULT_OUTFIT, wearItem } from './avatar/outfit.ts';
import { ITEMS_BY_ID } from './avatar/wardrobeItems.ts';

const wear = (o, ...ids) => ids.reduce((x, id) => wearItem(x, ITEMS_BY_ID.get(id)), { ...o, colors: {} });
const L = (o, g) => comboLayers(o, WORN_BANDS[g], g).map(l => `${l.item}.${l.band}`);

test('jersey + track pants shows both (male and female)', () => {
  for (const [g, o] of [['male', DEFAULT_OUTFIT], ['female', DEFAULT_FEMALE_OUTFIT]]) { // male default wears a hoodie: the picked jersey shows
    const x = wear({ ...o, gender: g === 'female' ? 'female' : undefined }, 'top-feyenoord-jersey', 'bottom-adidas-track');
    const l = L(x, g);
    assert.ok(l.includes('bottom-adidas-track.legs') && l.includes('top-feyenoord-jersey.torso'), `${g}: ${l}`);
  }
});

test('last picked torso item is the visible upper body', () => {
  const x = wear(DEFAULT_OUTFIT, 'top-psv-jersey', 'outer-carhartt-black', 'bottom-bf-shorts');
  assert.ok(L(x, 'male').includes('outer-carhartt-black.torso'));
  assert.ok(L(wear(x, 'top-psv-jersey'), 'male').includes('top-psv-jersey.torso'));
});

test('jacket + shorts + crocs + beanie: every band from its own item, stacked legs < feet < torso < head', () => {
  const x = wear(DEFAULT_OUTFIT, 'outer-carhartt-black', 'bottom-bf-shorts', 'shoes-crocs-clog', 'hat-trivo-beanie');
  assert.deepEqual(L(x, 'male'), ['bottom-bf-shorts.legs', 'shoes-crocs-clog.feet', 'outer-carhartt-black.torso', 'hat-trivo-beanie.head']);
});

test('dress replaces top+bottom bands; long coat owns the legs; missing art falls back to the base', () => {
  const d = wear({ ...DEFAULT_FEMALE_OUTFIT, outerwear: null }, 'dress-bf-mint-maxi', 'hat-prada-fedora');
  assert.deepEqual(L(d, 'female'), ['dress-bf-mint-maxi.legs', 'shoes-nike-white.feet', 'dress-bf-mint-maxi.torso', 'hat-prada-fedora.head']);
  const t = wear(DEFAULT_OUTFIT, 'outer-rossano-trench', 'bottom-bf-shorts');
  assert.ok(L(t, 'male').includes('outer-rossano-trench.legs'));
  const none = { ...DEFAULT_OUTFIT, top: null, outerwear: null, bottom: null, shoes: null, colors: {} };
  assert.equal(comboId(comboLayers(none, WORN_BANDS.male, 'male')), 'combo:top-blueberry-white-tee.sole+top-blueberry-white-tee.legs+top-blueberry-white-tee.torso+top-blueberry-white-tee.head');
  for (const g of ['male', 'female']) for (const it of Object.values(WORN_BANDS[g].items)) assert.ok(Object.keys(it.bands).length, g);
});

test('female Strideon cap = the black start cap of the base art (no white-cap overlay)', () => {
  const l = L({ ...DEFAULT_FEMALE_OUTFIT, worn: 'top-nike-black-tee' }, 'female');
  assert.ok(l.at(-1) === 'top-nike-black-tee.head', l.join());
});
