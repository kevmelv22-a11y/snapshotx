/**
 * "Worn" art: one full-body image per (gender, item) showing the doll wearing exactly that item
 * (assets/avatar-art/worn/<gender>/<itemId>.png, map in lib/wornArt.ts). The Kast shows the worn image
 * of the most recently picked item (Outfit.worn) while it is still on; otherwise callers fall back.
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit, WardrobeCategory } from './outfit';

const CATS: WardrobeCategory[] = ['top', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'outerwear', 'hat', 'accessory', 'glasses'];

/** Key `<gender>/<itemId>` of the worn image to draw, or null (no pick, item taken off, or no art for this gender). */
export function wornArtKey(o: Outfit, available: { has(k: string): boolean }): string | null {
  const id = o.worn;
  if (!id || !CATS.some(c => o[c] === id)) return null;
  const key = `${o.gender ?? 'male'}/${id}`;
  return available.has(key) ? key : null;
}
