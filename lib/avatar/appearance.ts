/**
 * Bridge between the classic avatar editor (/avatar-editor, AvatarAppearance indices stored in
 * user_metadata.snaplion_avatar) and the Bitmoji-kast outfit (stores/wardrobe.ts).
 * Pure (type-only imports) so it runs under `node --test`.
 *
 * Precedence, once a wardrobe outfit is saved:
 *  - Clothes always come from the wardrobe outfit (the classic top/bottoms/shoes/accessory only drive
 *    the classic fallback art that is shown when no outfit is saved).
 *  - Appearance (skin, hair colour, hairstyle): latest edit wins. Saving in the classic editor merges
 *    the fields the user actually touched there into the saved outfit (and bumps its savedAt); a later
 *    change in the kast simply overwrites the outfit again. There is one source of truth: the outfit.
 */
import type { AvatarAppearance } from '../avatar';
import type { HairStyle, Outfit } from './outfit';

/** Classic palettes (shared with components/MapAvatar.tsx). */
export const CLASSIC_SKIN = ['#EBC5A3', '#F2BE91', '#CE9E79', '#A9775D', '#744737'] as const;
export const CLASSIC_HAIR = ['#24212F', '#4D302C', '#70442E', '#BC873D', '#A8512C'] as const;
/** Classic hairstyles: Kort, Golvend, Krullen, Pet. "Pet" is short hair under the classic cap (a hat, not hair). */
export const CLASSIC_HAIRSTYLE: readonly HairStyle[] = ['short', 'wavy', 'curly', 'short'];

export type AppearanceField = 'skin' | 'hair' | 'hairstyle';
export const APPEARANCE_FIELDS: readonly AppearanceField[] = ['skin', 'hair', 'hairstyle'];

export function isAppearanceField(key: string): key is AppearanceField {
  return (APPEARANCE_FIELDS as readonly string[]).includes(key);
}

/** Copies the given classic appearance fields onto the outfit (clothes untouched). Returns the same object when nothing applies. */
export function mergeAppearance(outfit: Outfit, appearance: AvatarAppearance, fields: readonly AppearanceField[]): Outfit {
  if (!fields.length) return outfit;
  const next: Outfit = { ...outfit, colors: { ...outfit.colors } };
  for (const field of fields) {
    if (field === 'skin' && CLASSIC_SKIN[appearance.skin]) next.colors.skin = CLASSIC_SKIN[appearance.skin];
    if (field === 'hair' && CLASSIC_HAIR[appearance.hair]) next.colors.hair = CLASSIC_HAIR[appearance.hair];
    if (field === 'hairstyle' && CLASSIC_HAIRSTYLE[appearance.hairstyle]) next.hairStyle = CLASSIC_HAIRSTYLE[appearance.hairstyle];
  }
  return next;
}

/** Whether classic option `index` of `field` is what the outfit currently shows (for the editor's check mark). */
export function outfitMatchesAppearance(outfit: Outfit, field: AppearanceField, index: number): boolean {
  const same = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  if (field === 'skin') return same(outfit.colors.skin, CLASSIC_SKIN[index]);
  if (field === 'hair') return same(outfit.colors.hair, CLASSIC_HAIR[index]);
  return index !== 3 && outfit.hairStyle === CLASSIC_HAIRSTYLE[index];
}
