/**
 * Staff-only clothing (one premium outfit per staff role). Gating reuses the staff roles from
 * hooks/useStaffRoles (sx user_roles → roles, same source as the staff console): an item with `staffRoles` is only
 * listed in the wardrobe and wearable when the signed-in user holds one of those roles. Pure TS (tested).
 */
import { CATEGORIES, type Outfit, type WardrobeItem } from './outfit';

export type StaffRoleName = 'MODERATOR' | 'SENIOR MODERATOR' | 'ADMIN' | 'OWNER';

/** Who may see/wear each staff outfit (higher roles also get the outfits of the roles below them). */
export const STAFF_OUTFIT_ROLES: Record<'owner' | 'admin' | 'mod', readonly StaffRoleName[]> = {
  owner: ['OWNER'],
  admin: ['ADMIN', 'OWNER'],
  mod: ['MODERATOR', 'SENIOR MODERATOR', 'ADMIN', 'OWNER'],
};

export const isStaffItem = (item: Pick<WardrobeItem, 'staffRoles'> | undefined) => !!item?.staffRoles?.length;

export function canUseItem(item: Pick<WardrobeItem, 'staffRoles'>, roles: readonly string[]): boolean {
  return !item.staffRoles?.length || item.staffRoles.some(r => roles.includes(r));
}

/** The wardrobe as this user may see it (staff items without a matching role are hidden). */
export function visibleItems<T extends WardrobeItem>(items: readonly T[], roles: readonly string[]): T[] {
  return items.filter(i => canUseItem(i, roles));
}

/** Removes staff items the user may not wear (e.g. a role was revoked); other layers are kept. */
export function stripStaffItems(outfit: Outfit, items: readonly WardrobeItem[], roles: readonly string[]): Outfit {
  const byId = new Map(items.map(i => [i.id, i]));
  let out: Outfit | null = null;
  for (const c of CATEGORIES) {
    const item = outfit[c] ? byId.get(outfit[c]!) : undefined;
    if (!item || canUseItem(item, roles)) continue;
    out ??= { ...outfit, colors: { ...outfit.colors } };
    if (out.worn === item.id) delete out.worn;
    if (out.torso === item.id) delete out.torso;
    out[c] = null; delete out.colors[c];
  }
  return out ?? outfit;
}
