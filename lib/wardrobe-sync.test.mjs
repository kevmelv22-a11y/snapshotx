import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_OUTFIT, applyLook, parseOutfit, reconcile, recolor, sameOutfit, unownedItems, wearItem } from './avatar/outfit.ts';
import { CURATED_LOOKS, HAIR_STYLE_LABELS, ITEMS_BY_ID, WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';

const robe = ITEMS_BY_ID.get('outer-paramount-emperor-robe');
const t = iso => new Date(iso).toISOString();

test('reconcile: newest updatedAt wins, unlocks are merged', () => {
  const localOutfit = wearItem(DEFAULT_OUTFIT, robe);
  const local = { outfit: localOutfit, unlocked: ['outer-paramount-emperor-robe'], updatedAt: t('2026-10-07T10:00:00Z') };
  const older = { outfit: DEFAULT_OUTFIT, unlocked: ['bag-coach-pink'], updatedAt: t('2026-10-06T10:00:00Z') };
  const r1 = reconcile(local, older);
  assert.equal(r1.source, 'local');
  assert.ok(r1.push, 'remote is older -> push');
  assert.equal(r1.outfit.outerwear, 'outer-paramount-emperor-robe');
  assert.deepEqual(new Set(r1.unlocked), new Set(['outer-paramount-emperor-robe', 'bag-coach-pink']));

  const newer = { ...older, updatedAt: t('2026-10-08T10:00:00Z') };
  const r2 = reconcile(local, newer);
  assert.equal(r2.source, 'remote');
  assert.ok(sameOutfit(r2.outfit, DEFAULT_OUTFIT));
  assert.ok(r2.push, 'remote lacks the local unlock -> push merged unlocks');

  const same = reconcile(local, { ...local, unlocked: [...local.unlocked] });
  assert.equal(same.push, false, 'identical copies -> nothing to do');
});

test('reconcile: never-saved device adopts the account copy; no remote row -> push local save', () => {
  const fresh = { outfit: DEFAULT_OUTFIT, unlocked: [], updatedAt: null };
  const remote = { outfit: recolor(DEFAULT_OUTFIT, 'hair', '#1E1A19'), unlocked: [], updatedAt: t('2026-10-01T00:00:00Z') };
  const r = reconcile(fresh, remote);
  assert.equal(r.source, 'remote');
  assert.equal(r.outfit.colors.hair, '#1E1A19');
  assert.equal(r.push, false);
  assert.equal(reconcile(fresh, null).push, false, 'nothing saved anywhere -> no push');
  assert.equal(reconcile({ ...remote }, null).push, true);
});

test('applyLook replaces every clothing layer, keeps hair/skin', () => {
  const body = recolor(recolor({ ...DEFAULT_OUTFIT, hairStyle: 'afro' }, 'hair', '#1E1A19'), 'skin', '#74432A');
  const gala = CURATED_LOOKS.find(l => l.id === 'look-gala');
  const o = applyLook(recolor(body, 'top', '#2F6FD6'), gala.items);
  assert.equal(o.dress, 'dress-festive-red-gown');
  assert.equal(o.top, null);
  assert.equal(o.outerwear, null);
  assert.equal(o.hairStyle, 'afro');
  assert.deepEqual(o.colors, { hair: '#1E1A19', skin: '#74432A' });
  assert.deepEqual(unownedItems(o, WARDROBE_ITEMS, []).map(i => i.id).sort(), ['bag-coach-pink', 'dress-festive-red-gown', 'glasses-miumiu-cateye', 'shoes-versace-chunky'].filter(id => ITEMS_BY_ID.get(id).priceCents != null).sort());
  assert.deepEqual(unownedItems(o, WARDROBE_ITEMS, ['dress-festive-red-gown', 'bag-coach-pink', 'glasses-miumiu-cateye', 'shoes-versace-chunky']), []);
});

test('curated looks only reference catalogue items in the right category', () => {
  assert.ok(CURATED_LOOKS.length >= 6);
  for (const look of CURATED_LOOKS) {
    for (const [category, id] of Object.entries(look.items)) {
      assert.equal(ITEMS_BY_ID.get(id)?.category, category, `${look.id}: ${id}`);
    }
  }
});

test('parseOutfit keeps valid hair style / skin and rejects junk', () => {
  const o = parseOutfit({ ...DEFAULT_OUTFIT, hairStyle: 'bun', colors: { skin: '#9C5E3C', hair: 'red' } }, WARDROBE_ITEMS);
  assert.equal(o.hairStyle, 'bun');
  assert.equal(o.colors.skin, '#9C5E3C');
  assert.equal(o.colors.hair, undefined);
  assert.equal(parseOutfit({ ...DEFAULT_OUTFIT, hairStyle: 'mohawk' }, WARDROBE_ITEMS).hairStyle, 'curly');
  assert.equal(Object.keys(HAIR_STYLE_LABELS).length, 13);
});
