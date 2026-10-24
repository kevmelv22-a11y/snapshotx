import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ITEMS_BY_ID } from './avatar/wardrobeItems.ts';
import { WORN_BANDS } from './avatar/wornBandInfo.ts';

const IDS = ['shoes-royaums-kilian-black', 'shoes-royaums-kilian-grey', 'shoes-royaums-luisa-white'];

test('Royaums sneakers are wardrobe shoes with art for both genders', () => {
  for (const id of IDS) {
    const it = ITEMS_BY_ID.get(id);
    assert.ok(it, id);
    assert.equal(it.category, 'shoes');
    assert.equal(it.brand, 'Royaums');
    assert.ok(existsSync(new URL(`../assets/avatar-art/items/${id}.png`, import.meta.url)), `thumb ${id}`);
    for (const g of ['male', 'female']) {
      assert.ok(existsSync(new URL(`../assets/avatar-art/worn/${g}/${id}.png`, import.meta.url)), `worn ${g} ${id}`);
      assert.ok(WORN_BANDS[g].items[id]?.bands.feet, `feet band ${g} ${id}`);
    }
  }
});
