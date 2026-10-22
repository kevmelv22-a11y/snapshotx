// Pre-rendered avatar art selection (lib/avatar/avatarArt.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as A from './avatar/avatarArt.ts';
const { LOOK_ART, POSE_ART, STICKER_ART } = A;
import { applyLook, DEFAULT_OUTFIT } from './avatar/outfit.ts';
import { TRY_LOOKS, MODE_HERO_ITEMS } from './avatar/modeLooks.ts';
const D = { hero: MODE_HERO_ITEMS, looks: TRY_LOOKS };
const lookArtFor = o => A.lookArtFor(o, D), bustArtFor = o => A.bustArtFor(o, D), poseArtFor = (o, p) => A.poseArtFor(o, p, D);
import { AVATAR_POSES, AVATAR_STICKERS } from './avatar/poses.ts';

const def = { ...applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), hairStyle: 'short', colors: { hair: '#D9B35F', skin: '#74432A' } };

test('default outfit uses art for every pose + think, regardless of hair/skin', () => {
  assert.equal(lookArtFor(def), 'look-default-hoodie');
  assert.equal(bustArtFor(def), 'bust');
  assert.equal(poseArtFor(def, 'think'), 'pose-thinking');
  for (const p of AVATAR_POSES) assert.ok(poseArtFor(def, p.id), p.id);
});

test('each Mode look has its own image in reference order; poses fall back', () => {
  assert.deepEqual(TRY_LOOKS.map(l => LOOK_ART[l.id]), ['look-green-jacket', 'look-black-bomber', 'look-tan-jacket', 'look-denim-jacket', 'look-cream-hoodie', 'look-ripped-jeans']);
  for (const l of TRY_LOOKS) {
    const o = applyLook(DEFAULT_OUTFIT, l.items);
    assert.equal(lookArtFor(o), LOOK_ART[l.id]);
    assert.equal(poseArtFor(o, 'wave'), null);
    assert.equal(bustArtFor(o), null);
  }
});

test('other outfits / clothing recolours fall back to 3D/2D', () => {
  assert.equal(lookArtFor({ ...def, hat: 'hat-bf-beanie' }), null);
  assert.equal(lookArtFor({ ...def, colors: { outerwear: '#FF0000' } }), null);
  assert.equal(lookArtFor(DEFAULT_OUTFIT), null);
});

test('sticker mapping and every referenced image exists', () => {
  const want = { hoi: 'pose-wave', top: 'pose-thumbsup', haha: 'pose-laugh', yes: 'pose-cheer', peace: 'pose-peace', 'geen-idee': 'pose-shrug', knipoog: 'pose-wink', wauw: 'pose-surprised', hartje: 'pose-heart', oke: 'pose-ok', sst: 'pose-shush', 'bel-me': 'pose-callme' };
  for (const s of AVATAR_STICKERS) { assert.equal(STICKER_ART[s.id], want[s.id]); assert.equal(POSE_ART[s.art ?? s.pose], want[s.id]); }
  for (const k of new Set([...Object.values(LOOK_ART), ...Object.values(POSE_ART), 'bust'])) assert.ok(existsSync(new URL(`../assets/avatar-art/${k}.png`, import.meta.url)), k);
});
