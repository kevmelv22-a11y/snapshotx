// Man/Vrouw character sets: start looks + art selection by gender (lib/avatar/avatarArt.ts, outfit.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as A from './avatar/avatarArt.ts';
import { applyLook, DEFAULT_OUTFIT, DEFAULT_FEMALE_OUTFIT, defaultOutfitFor, parseOutfit, sameOutfit } from './avatar/outfit.ts';
import { TRY_LOOKS, MODE_HERO_ITEMS } from './avatar/modeLooks.ts';
import { WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';
import { AVATAR_POSES } from './avatar/poses.ts';
const D = { hero: MODE_HERO_ITEMS, looks: TRY_LOOKS, alt: [DEFAULT_OUTFIT], female: DEFAULT_FEMALE_OUTFIT };
const F = defaultOutfitFor('female'), M = defaultOutfitFor('male');

test('start looks: male = hoodie, female = black cap + black tee + grey jeans', () => {
  assert.equal(M.outerwear, 'outer-nike-swoosh-hoodie'); assert.equal(M.gender, undefined);
  assert.deepEqual([F.hat, F.top, F.bottom, F.outerwear, F.gender], ['hat-nike-cap', 'top-nike-black-tee', 'bottom-basisbes-grey-jeans', null, 'female']);
  for (const id of [F.hat, F.top, F.bottom, F.shoes]) assert.ok(WARDROBE_ITEMS.some(i => i.id === id), id);
  assert.notEqual(defaultOutfitFor('female'), defaultOutfitFor('female')); // fresh copy each time
});

test('female start look uses the girl set everywhere; male keeps the male set', () => {
  assert.equal(A.bustArtFor(F, D), 'girl/bust');
  assert.equal(A.bustArtFor(M, D), 'bust');
  assert.equal(A.poseArtFor(F, 'think', D), 'girl/pose-thinking');
  assert.equal(A.lookArtFor(F, D), 'girl/pose-thinking');
  assert.equal(A.lookArtFor(M, D), 'look-default-hoodie');
  for (const p of AVATAR_POSES) { const k = A.poseArtFor(F, p.id, D); assert.ok(k && k.startsWith('girl/'), p.id); }
});

test('female try-looks map to the girl look images (cap is dropped by applyLook)', () => {
  for (const l of TRY_LOOKS) {
    const o = applyLook(F, l.items);
    assert.equal(o.gender, 'female');
    assert.equal(A.lookArtFor(o, D), `girl/${A.LOOK_ART[l.id]}`);
    assert.equal(A.lookCardArt(l.id, 'female'), `girl/${A.LOOK_ART[l.id]}`);
    assert.equal(A.lookCardArt(l.id, undefined), A.LOOK_ART[l.id]);
  }
});

test('the hoodie on a female character is not her default (no male art leaks in)', () => {
  const hoodie = { ...applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), gender: 'female' };
  assert.equal(A.bustArtFor(hoodie, D), null);
});

test('gender survives parse; changes sameOutfit', () => {
  assert.equal(parseOutfit(F, WARDROBE_ITEMS).gender, 'female');
  assert.equal(parseOutfit(M, WARDROBE_ITEMS).gender, undefined);
  assert.equal(sameOutfit(F, { ...F, gender: 'male' }), false);
});

test('every girl art file exists; migration adds a checked gender column', () => {
  const keys = ['bust', ...Object.values(A.LOOK_ART), ...Object.values(A.POSE_ART).filter(k => k !== 'look-default-hoodie')];
  for (const k of keys) assert.ok(existsSync(new URL(`../assets/avatar-art/girl/${k}.png`, import.meta.url)), k);
  const sql = readFileSync(new URL('../supabase/migrations/20261013210000_profile_gender.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column if not exists gender text not null default 'male'/);
  assert.match(sql, /check \(gender in \('male', 'female'\)\)/);
});

test('nearestLookArt: exact looks map 1:1, everything else gets the closest art (never null)', async () => {
  const { WARDROBE_ITEMS: W } = await import('./avatar/wardrobeItems.ts');
  const colorOf = id => W.find(i => i.id === id)?.colors[0] ?? null;
  const near = o => A.nearestLookArt(o, D, colorOf);
  assert.equal(near(M), 'look-default-hoodie');
  assert.equal(near(F), 'girl/pose-thinking');
  for (const l of TRY_LOOKS) { assert.equal(near(applyLook(M, l.items)), A.LOOK_ART[l.id]); assert.equal(near(applyLook(F, l.items)), `girl/${A.LOOK_ART[l.id]}`); }
  // recolour keeps the same art; a random outfit still resolves to some art of the right gender
  assert.equal(near({ ...M, colors: { outerwear: '#FF0000' } }), 'look-default-hoodie');
  for (const it of W) {
    const m = near({ ...M, [it.category]: it.id }), f = near({ ...F, [it.category]: it.id });
    assert.ok(m && !m.startsWith('girl/'), it.id); assert.ok(f.startsWith('girl/'), it.id);
  }
  // denim jacket on the hoodie outfit is closest to the denim look
  assert.equal(near({ ...M, outerwear: 'outer-basisbes-denim-jacket', bottom: 'bottom-strideon-black-cargo' }), 'look-denim-jacket');
});

test('every wardrobe item has a Kast thumbnail registered in components/avatar/itemArt.ts', async () => {
  const { WARDROBE_ITEMS: W } = await import('./avatar/wardrobeItems.ts');
  const src = readFileSync(new URL('../components/avatar/itemArt.ts', import.meta.url), 'utf8');
  for (const it of W) {
    assert.ok(src.includes(`'${it.id}': require('../../assets/avatar-art/items/${it.id}.png')`), it.id);
    assert.ok(existsSync(new URL(`../assets/avatar-art/items/${it.id}.png`, import.meta.url)), it.id);
  }
});
