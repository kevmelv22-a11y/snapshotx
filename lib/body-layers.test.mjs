// Layered body art selection (lib/avatar/bodyLayers.ts) + Mode-grid/preview consistency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyLayersFor } from './avatar/bodyLayers.ts';
import * as A from './avatar/avatarArt.ts';
import { applyLook, DEFAULT_OUTFIT, DEFAULT_FEMALE_OUTFIT } from './avatar/outfit.ts';
import { TRY_LOOKS, MODE_HERO_ITEMS } from './avatar/modeLooks.ts';

test('layers: null without base or with a missing worn layer; ordered base→hat', () => {
  const o = { ...DEFAULT_OUTFIT, colors: {} };
  assert.equal(bodyLayersFor(o, new Set()), null);
  const all = new Set(['male/base', `male/${o.top}`, `male/${o.bottom}`, `male/${o.shoes}`, `male/${o.outerwear}`]);
  assert.deepEqual(bodyLayersFor(o, all), ['male/base', `male/${o.shoes}`, `male/${o.bottom}`, `male/${o.top}`, `male/${o.outerwear}`]);
  all.delete(`male/${o.top}`);
  assert.equal(bodyLayersFor(o, all), null);
  assert.equal(bodyLayersFor({ ...DEFAULT_FEMALE_OUTFIT }, new Set(['male/base'])), null);
});

test('Mode grid: applying each look gives its own look art, male and female', () => {
  const D = { hero: MODE_HERO_ITEMS, looks: TRY_LOOKS, alt: [DEFAULT_OUTFIT], female: DEFAULT_FEMALE_OUTFIT };
  for (const start of [DEFAULT_OUTFIT, DEFAULT_FEMALE_OUTFIT]) for (const l of TRY_LOOKS) {
    const o = applyLook(start, l.items);
    assert.equal(A.nearestLookArt(o, D, () => null), A.lookCardArt(l.id, start.gender), `${start.gender ?? 'male'} ${l.id}`);
  }
});

test('nearestLookArt: changing the hidden tee under the hoodie keeps the hoodie art', () => {
  const D = { hero: MODE_HERO_ITEMS, looks: TRY_LOOKS, alt: [DEFAULT_OUTFIT], female: DEFAULT_FEMALE_OUTFIT };
  for (const top of ['top-bf-skull-tee', 'top-bf-pumpkin-tee'])
    assert.equal(A.nearestLookArt({ ...DEFAULT_OUTFIT, colors: {}, top }, D, () => '#888888'), 'look-default-hoodie');
});
