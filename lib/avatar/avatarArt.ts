/**
 * Pre-rendered avatar art (assets/avatar-art/*.png) — the DEFAULT avatar art.
 *
 * IMPORTANT: these images show ONE fixed default character (dark curly hair, fixed face/skin). They are
 * chosen by CLOTHING (+ pose) only; the user's hair style / hair colour / skin / eye personalisation is NOT
 * reflected in them. Outfit + pose combinations without an image fall back to the 3D / 2D renderers.
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit, WardrobeCategory } from './outfit';
import type { PoseId } from './poses';

/** Clothing of the default look + the Mode looks (passed in so this module stays import-free at runtime). */
export type LookData = { hero: Partial<Record<WardrobeCategory, string>>; looks: readonly { id: string; items: Partial<Record<WardrobeCategory, string>> }[] };

export type LookArtKey = 'look-default-hoodie' | 'look-green-jacket' | 'look-black-bomber' | 'look-tan-jacket' | 'look-denim-jacket' | 'look-cream-hoodie' | 'look-ripped-jeans';
export type PoseArtKey = 'pose-thinking' | 'pose-wave' | 'pose-thumbsup' | 'pose-laugh' | 'pose-cheer' | 'pose-peace' | 'pose-shrug' | 'pose-wink' | 'pose-surprised';
export type ArtKey = LookArtKey | PoseArtKey | 'bust';

/** Mode-grid look id → image (reference order: green, black, tan, denim, cream, ripped). */
export const LOOK_ART: Record<string, LookArtKey> = {
  'try-olive': 'look-green-jacket', 'try-coach': 'look-black-bomber', 'try-camel': 'look-tan-jacket',
  'try-denim': 'look-denim-jacket', 'try-cream': 'look-cream-hoodie', 'try-jeans': 'look-ripped-jeans',
};

/** Pose → image of the default (hoodie + grey jeans) outfit. 'think' is the Mode hero pose. */
export const POSE_ART: Record<PoseId | 'think', LookArtKey | PoseArtKey> = {
  stand: 'look-default-hoodie', think: 'pose-thinking', wave: 'pose-wave', thumbs: 'pose-thumbsup', laugh: 'pose-laugh',
  cheer: 'pose-cheer', peace: 'pose-peace', shrug: 'pose-shrug', wink: 'pose-wink', surprised: 'pose-surprised',
};

const CLOTHES: WardrobeCategory[] = ['top', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'outerwear', 'hat', 'accessory', 'glasses'];

/** True when the outfit wears exactly these items (other layers empty) without clothing recolours. */
function wears(outfit: Outfit, items: Partial<Record<WardrobeCategory, string>>): boolean {
  for (const c of CLOTHES) {
    if ((outfit[c] ?? null) !== (items[c] ?? null)) return false;
    if (outfit.colors[c]) return false;
  }
  return true;
}

export function isDefaultLook(outfit: Outfit, d: LookData): boolean { return wears(outfit, d.hero); }

/** Full-body image for an outfit (standing), or null. */
export function lookArtFor(outfit: Outfit, d: LookData): LookArtKey | null {
  if (isDefaultLook(outfit, d)) return 'look-default-hoodie';
  for (const l of d.looks) if (LOOK_ART[l.id] && wears(outfit, l.items)) return LOOK_ART[l.id];
  return null;
}

/** Posed image (only the default outfit has pose art; standing works for every look). */
export function poseArtFor(outfit: Outfit, pose: PoseId | 'think', d: LookData): LookArtKey | PoseArtKey | null {
  if (pose === 'stand') return lookArtFor(outfit, d);
  return isDefaultLook(outfit, d) ? POSE_ART[pose] ?? null : null;
}

/** Profile bust portrait (black hoodie): only for the default outfit. */
export function bustArtFor(outfit: Outfit, d: LookData): 'bust' | null { return isDefaultLook(outfit, d) ? 'bust' : null; }

/** Sticker → pose image (Hoi!=wave, Top!=thumbsup, Haha=laugh, Yes!=cheer, Peace=peace, Geen idee=shrug, Deal=wink, Wauw!=surprised). */
export const STICKER_ART: Record<string, PoseArtKey> = {
  hoi: 'pose-wave', top: 'pose-thumbsup', haha: 'pose-laugh', yes: 'pose-cheer', peace: 'pose-peace', 'geen-idee': 'pose-shrug', knipoog: 'pose-wink', wauw: 'pose-surprised',
};
