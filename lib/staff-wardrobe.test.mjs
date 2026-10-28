// Staff-only wardrobe items: hidden and unwearable without a matching staff role.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WARDROBE_ITEMS, ITEMS_BY_ID } from './avatar/wardrobeItems.ts';
import { canUseItem, visibleItems, stripStaffItems, STAFF_OUTFIT_ROLES } from './avatar/staffWardrobe.ts';
import { DEFAULT_OUTFIT, wearItem } from './avatar/outfit.ts';
import { readFileSync } from 'node:fs';
const WORN = readFileSync(new URL('./wornArt.ts', import.meta.url), 'utf8');
const THUMBS = readFileSync(new URL('../components/avatar/itemArt.ts', import.meta.url), 'utf8');

const STAFF = ['top-staff-owner-jersey', 'top-staff-admin-jersey', 'top-staff-mod-jersey'];
test('three staff outfits, each with boy + girl worn art and a thumbnail', () => {
  for (const id of STAFF) {
    assert.ok(ITEMS_BY_ID.get(id)?.staffRoles?.length, id);
    for (const g of ['male', 'female']) assert.ok(WORN.includes(`'${g}/${id}'`), `${g}/${id}`);
    assert.ok(THUMBS.includes(`'${id}': require(`), id);
  }
});
test('normal users see no staff items; each role sees its own (and lower) outfits', () => {
  const ids = roles => visibleItems(WARDROBE_ITEMS, roles).filter(i => i.staffRoles).map(i => i.id).sort();
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids(['MODERATOR']), ['top-staff-mod-jersey']);
  assert.deepEqual(ids(['SENIOR MODERATOR']), ['top-staff-mod-jersey']);
  assert.deepEqual(ids(['ADMIN']), ['top-staff-admin-jersey', 'top-staff-mod-jersey']);
  assert.deepEqual(ids(['OWNER']), [...STAFF].sort());
  assert.equal(visibleItems(WARDROBE_ITEMS, []).length, WARDROBE_ITEMS.length - 3);
  assert.deepEqual(STAFF_OUTFIT_ROLES.owner, ['OWNER']);
});
test('a staff item is taken off when the role is missing; regular items stay', () => {
  const owner = ITEMS_BY_ID.get('top-staff-owner-jersey');
  assert.equal(canUseItem(owner, ['ADMIN']), false);
  const o = wearItem(DEFAULT_OUTFIT, owner);
  const s = stripStaffItems(o, WARDROBE_ITEMS, ['MODERATOR']);
  assert.equal(s.top, null); assert.equal(s.bottom, o.bottom);
  assert.equal(stripStaffItems(o, WARDROBE_ITEMS, ['OWNER']), o);
  assert.equal(stripStaffItems(DEFAULT_OUTFIT, WARDROBE_ITEMS, []), DEFAULT_OUTFIT);
});
