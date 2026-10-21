/**
 * Layered body art (assets/avatar-art/body/<gender>/): one fixed base body per gender plus one transparent
 * full-canvas PNG per garment, all on the SAME canvas and pose, stacked in LAYER_ORDER. Lets the Kast preview
 * show any combination of items without per-combo art. Used only when the base AND every worn visible item
 * have a layer; otherwise callers fall back to the closest look art (avatarArt.nearestLookArt).
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit, WardrobeCategory } from './outfit';

/** Bottom → top. Socks/bag/accessory/glasses are not layered (ignored, they don't block the composite). */
export const LAYER_ORDER = ['shoes', 'bottom', 'dress', 'top', 'outerwear', 'hat'] as const satisfies readonly WardrobeCategory[];
export const CANVAS = { w: 768, h: 1536 } as const;

export type BodyGender = 'male' | 'female';
export const layerKey = (g: BodyGender, id: string) => `${g}/${id}`;
export const baseKey = (g: BodyGender) => `${g}/base`;

/** Ordered layer keys (base first) for this outfit, or null when any needed layer is missing. */
export function bodyLayersFor(outfit: Outfit, available: ReadonlySet<string>): string[] | null {
  const g: BodyGender = outfit.gender === 'female' ? 'female' : 'male';
  if (!available.has(baseKey(g))) return null;
  const keys = [baseKey(g)];
  for (const c of LAYER_ORDER) {
    const id = outfit[c];
    if (!id) continue;
    if (!available.has(layerKey(g, id))) return null;
    keys.push(layerKey(g, id));
  }
  return keys;
}
