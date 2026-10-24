// 3D avatar rig mapping (lib/avatar3d/rig.ts): outfit ids → glTF modules / colours, faces, poses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rigFromOutfit, isNodeVisible, faceFor, POSES_3D, pose3D, snapshotKey, HAIR_NODES, ALL_MODULES, MODULE_PREFIX, shadeHex } from './avatar3d/rig.ts';
import { WARDROBE_ITEMS, ITEMS_BY_ID } from './avatar/wardrobeItems.ts';
import { applyLook, DEFAULT_OUTFIT, HAIR_STYLES, parseOutfit } from './avatar/outfit.ts';
import { TRY_LOOKS, MODE_HERO_ITEMS } from './avatar/modeLooks.ts';
import { AVATAR_POSES } from './avatar/poses.ts';

const lookup = id => ITEMS_BY_ID.get(id);
const glbNames = (() => {
  const b = readFileSync(new URL('../assets/avatar3d/avatar.glb', import.meta.url));
  const len = b.readUInt32LE(12);
  return new Set(JSON.parse(b.subarray(20, 20 + len).toString('utf8')).nodes.map(n => n.name));
})();

test('hero look (hoodie + grey jeans + panda lowtops) maps to hoodie/straight/sneaker with item colours', () => {
  const rig = rigFromOutfit({ ...applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), hairStyle: 'curly' }, lookup);
  assert.deepEqual(rig.modules, ['outer_hoodie', 'bottom_straight', 'shoes_sneaker']);
  assert.equal(rig.colors.Outer, '#1B1B1E');
  assert.equal(rig.colors.Bottom, '#8A8D93');
  assert.equal(rig.colors.Shoe, '#F4F4F6');
  assert.equal(rig.colors.ShoeAccent, '#1C1C1E');
  assert.equal(rig.hair, 'curly');
});

test('all 6 Mode looks map to jackets/hoodie over a tee with the right trousers', () => {
  const want = { 'try-olive': 'outer_jacket', 'try-coach': 'outer_jacket', 'try-camel': 'outer_jacket', 'try-denim': 'outer_jacket', 'try-cream': 'outer_hoodie', 'try-jeans': 'outer_jacket' };
  assert.equal(TRY_LOOKS.length, 6);
  for (const look of TRY_LOOKS) {
    const rig = rigFromOutfit(applyLook(DEFAULT_OUTFIT, look.items), lookup);
    assert.ok(rig.modules.includes(want[look.id]), look.id);
    assert.equal(rig.modules.includes('top_tee'), want[look.id] !== 'outer_hoodie', look.id);
    assert.deepEqual(rig.approximated, [], look.id);
  }
  const cream = rigFromOutfit(applyLook(DEFAULT_OUTFIT, TRY_LOOKS.find(l => l.id === 'try-cream').items), lookup);
  assert.ok(cream.modules.includes('bottom_joggers'));
});

test('every wardrobe item maps to some module without throwing; recolour override wins', () => {
  for (const item of WARDROBE_ITEMS) {
    const o = applyLook(DEFAULT_OUTFIT, { [item.category]: item.id });
    const rig = rigFromOutfit(o, lookup);
    assert.ok(rig.modules.includes('shoes_sneaker') && rig.modules.some(m => m.startsWith('bottom_')), item.id);
  }
  const o = { ...applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), colors: { outerwear: '#224466', skin: '#74432A', hair: '#D9B35F', eyes: '#3F6E8F' } };
  const rig = rigFromOutfit(o, lookup);
  assert.equal(rig.colors.Outer, '#224466');
  assert.equal(rig.colors.Skin, '#74432A');
  assert.equal(rig.colors.Hair, '#D9B35F');
  assert.equal(rig.colors.Iris, '#3F6E8F');
});

test('eye colour survives parseOutfit (stored data model stays compatible)', () => {
  const parsed = parseOutfit({ ...DEFAULT_OUTFIT, colors: { eyes: '#3F6E8F', skin: '#ABCDEF' } }, WARDROBE_ITEMS);
  assert.equal(parsed.colors.eyes, '#3F6E8F');
  assert.equal(parseOutfit({ colors: { eyes: 'blue' } }, WARDROBE_ITEMS).colors.eyes, undefined);
});

test('glb contains every module, hair style, face variant and bone the rig refers to', () => {
  for (const style of HAIR_STYLES) for (const n of HAIR_NODES[style]) assert.ok(glbNames.has(n), n);
  for (const m of ALL_MODULES) assert.ok([...glbNames].some(n => MODULE_PREFIX[m].some(p => n.startsWith(p))), m);
  for (const n of ['MouthSmile', 'MouthNeutral', 'MouthLaugh', 'MouthSurprised', 'LidClosedR', 'LidUpperL', 'IrisL', 'head', 'upperArmL', 'forearmR', 'thighL']) assert.ok(glbNames.has(n), n);
  for (const p of Object.values(POSES_3D)) for (const b of Object.keys(p.bones)) assert.ok(glbNames.has(b), b);
});

test('visibility: one hair style, chosen modules, wink closes one eye', () => {
  const rig = { modules: ['outer_hoodie', 'bottom_straight', 'shoes_sneaker'], hair: 'long' };
  const smile = faceFor('smile');
  assert.equal(isNodeVisible('Hair_long', rig, smile), true);
  assert.equal(isNodeVisible('Hair_longBack', rig, smile), true);
  assert.equal(isNodeVisible('Hair_curly', rig, smile), false);
  assert.equal(isNodeVisible('Outer_hoodieTorso', rig, smile), true);
  assert.equal(isNodeVisible('Outer_jacketTorso', rig, smile), false);
  assert.equal(isNodeVisible('Top_teeTorso', rig, smile), false);
  assert.equal(isNodeVisible('Head', rig, smile), true);
  assert.equal(isNodeVisible('LidClosedR', rig, smile), false);
  const wink = faceFor('wink');
  assert.equal(isNodeVisible('LidClosedR', rig, wink), true);
  assert.equal(isNodeVisible('IrisR', rig, wink), false);
  assert.equal(isNodeVisible('IrisL', rig, wink), true);
  assert.equal(isNodeVisible('MouthLaugh', rig, faceFor('laugh')), true);
  assert.equal(isNodeVisible('MouthSmile', rig, faceFor('laugh')), false);
});

test('every 2D pose id has a 3D pose with the same expression; unknown ids fall back to stand', () => {
  for (const p of AVATAR_POSES) { assert.ok(POSES_3D[p.id], p.id); assert.equal(POSES_3D[p.id].expression, p.expression, p.id); }
  assert.equal(pose3D('nope'), POSES_3D.stand);
  assert.ok(POSES_3D.think.bones.forearmR);
});

test('snapshot keys change with colours/pose/size and are stable otherwise', () => {
  const a = rigFromOutfit(applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), lookup);
  const b = rigFromOutfit({ ...applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), colors: { skin: '#74432A' } }, lookup);
  assert.equal(snapshotKey(a, 'stand', 'head', 64), snapshotKey(rigFromOutfit(applyLook(DEFAULT_OUTFIT, MODE_HERO_ITEMS), lookup), 'stand', 'head', 64));
  assert.notEqual(snapshotKey(a, 'stand', 'head', 64), snapshotKey(b, 'stand', 'head', 64));
  assert.notEqual(snapshotKey(a, 'stand', 'head', 64), snapshotKey(a, 'wave', 'head', 64));
  assert.notEqual(snapshotKey(a, 'stand', 'head', 64), snapshotKey(a, 'stand', 'head', 65));
  assert.equal(shadeHex('#000000', 0.5), '#808080');
});
