import assert from 'node:assert/strict';
import test from 'node:test';
import { APPEARANCE_FIELDS, CLASSIC_HAIR, CLASSIC_SKIN, isAppearanceField, mergeAppearance, outfitMatchesAppearance } from './avatar/appearance.ts';
import { DEFAULT_OUTFIT, recolor, sameOutfit, wearItem } from './avatar/outfit.ts';
import { ITEMS_BY_ID } from './avatar/wardrobeItems.ts';

const classic = { skin: 4, hair: 3, hairstyle: 1, top: 5, bottoms: 3, shoes: 2, accessory: 4 };
const kast = recolor(recolor({ ...wearItem(DEFAULT_OUTFIT, ITEMS_BY_ID.get('outer-paramount-emperor-robe')), hairStyle: 'long' }, 'hair', '#123456'), 'skin', '#9C5E3C');

test('touched appearance fields from the classic editor override the outfit; clothes always stay', () => {
  const skinOnly = mergeAppearance(kast, classic, ['skin']);
  assert.equal(skinOnly.colors.skin, CLASSIC_SKIN[4]);
  assert.equal(skinOnly.colors.hair, '#123456', 'untouched hair keeps the kast colour');
  assert.equal(skinOnly.hairStyle, 'long', 'untouched hairstyle keeps the kast style');
  assert.equal(skinOnly.outerwear, 'outer-paramount-emperor-robe');

  const all = mergeAppearance(kast, classic, APPEARANCE_FIELDS);
  assert.equal(all.colors.hair, CLASSIC_HAIR[3]);
  assert.equal(all.hairStyle, 'wavy', 'Golvend -> wavy');
  for (const c of ['top', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'outerwear', 'hat', 'accessory', 'glasses']) assert.equal(all[c], kast[c], `${c} unchanged`);
  assert.equal(mergeAppearance(kast, { ...classic, hairstyle: 3 }, ['hairstyle']).hairStyle, 'short', 'Pet = short hair (no hat added)');
});

test('nothing touched -> outfit returned as is (the editor previews the saved outfit unchanged)', () => {
  assert.equal(mergeAppearance(kast, classic, []), kast);
  assert.ok(sameOutfit(mergeAppearance(kast, classic, []), kast));
  assert.equal(kast.colors.skin, '#9C5E3C', 'input not mutated');
});

test('check marks follow the outfit for untouched fields', () => {
  const o = mergeAppearance(DEFAULT_OUTFIT, classic, APPEARANCE_FIELDS);
  assert.equal(outfitMatchesAppearance(o, 'skin', 4), true);
  assert.equal(outfitMatchesAppearance(o, 'skin', 1), false);
  assert.equal(outfitMatchesAppearance(o, 'hair', 3), true);
  assert.equal(outfitMatchesAppearance(o, 'hairstyle', 1), true);
  assert.equal(outfitMatchesAppearance(kast, 'hairstyle', 0), false, 'kast-only style (long) matches no classic option');
  assert.equal(outfitMatchesAppearance({ ...kast, hairStyle: 'short' }, 'hairstyle', 3), false, 'Pet is never auto-checked');
  assert.equal(isAppearanceField('skin'), true);
  assert.equal(isAppearanceField('top'), false);
});
