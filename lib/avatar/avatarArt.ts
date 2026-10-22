/**
 * Pre-rendered avatar art (assets/avatar-art/*.png) — the DEFAULT avatar art.
 *
 * IMPORTANT: these images show ONE fixed default character (dark curly hair, fixed face/skin). They are
 * chosen by CLOTHING (+ pose) only; the user's hair style / hair colour / skin / eye personalisation is NOT
 * reflected in them. Outfit + pose combinations without an image fall back to the 3D / 2D renderers.
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit, WardrobeCategory } from './outfit';
import type { PoseId, StickerArtPose } from './poses';

/** Clothing of the default look + the Mode looks (passed in so this module stays import-free at runtime). */
export type LookData = { hero: Partial<Record<WardrobeCategory, string>>; looks: readonly { id: string; items: Partial<Record<WardrobeCategory, string>> }[];
  /** Other outfits that also show the default character (e.g. DEFAULT_OUTFIT of new users). */
  alt?: readonly Partial<Record<WardrobeCategory, string | null>>[];
  /** Female start look (DEFAULT_FEMALE_OUTFIT clothing). Without it no female outfit counts as default. */
  female?: Partial<Record<WardrobeCategory, string | null>> };

const isFemale = (o: Outfit) => o.gender === 'female';
/** Prefixes a male art key with the female set; her start look stands in the thinking pose. */
function forGender<K extends BaseArtKey>(o: Outfit, k: K | null): K | GirlArtKey | null {
  if (!k || !isFemale(o)) return k;
  return `girl/${k === 'look-default-hoodie' ? 'pose-thinking' : k}` as GirlArtKey;
}

export type LookArtKey = 'look-default-hoodie' | 'look-green-jacket' | 'look-black-bomber' | 'look-tan-jacket' | 'look-denim-jacket' | 'look-cream-hoodie' | 'look-ripped-jeans';
export type PoseArtKey = 'pose-thinking' | 'pose-wave' | 'pose-thumbsup' | 'pose-laugh' | 'pose-cheer' | 'pose-peace' | 'pose-shrug' | 'pose-wink' | 'pose-surprised' | 'pose-heart' | 'pose-ok' | 'pose-shush' | 'pose-callme';
type BaseArtKey = LookArtKey | PoseArtKey | 'bust';
/** Female set (assets/avatar-art/girl/): same looks/poses; her start look has no standing image (uses pose-thinking). */
export type GirlArtKey = `girl/${Exclude<BaseArtKey, 'look-default-hoodie'>}`;
export type ArtKey = BaseArtKey | GirlArtKey;

/** Mode-grid look id → image (reference order: green, black, tan, denim, cream, ripped). */
export const LOOK_ART: Record<string, LookArtKey> = {
  'try-olive': 'look-green-jacket', 'try-coach': 'look-black-bomber', 'try-camel': 'look-tan-jacket',
  'try-denim': 'look-denim-jacket', 'try-cream': 'look-cream-hoodie', 'try-jeans': 'look-ripped-jeans',
};

/** Pose → image of the default (hoodie + grey jeans) outfit. 'think' is the Mode hero pose. */
export const POSE_ART: Record<PoseId | 'think' | StickerArtPose, LookArtKey | PoseArtKey> = {
  stand: 'look-default-hoodie', think: 'pose-thinking', wave: 'pose-wave', thumbs: 'pose-thumbsup', laugh: 'pose-laugh',
  cheer: 'pose-cheer', peace: 'pose-peace', shrug: 'pose-shrug', wink: 'pose-wink', surprised: 'pose-surprised', heart: 'pose-heart',
  ok: 'pose-ok', shush: 'pose-shush', callme: 'pose-callme',
};

const CLOTHES: WardrobeCategory[] = ['top', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'outerwear', 'hat', 'accessory', 'glasses'];

/** True when the outfit wears exactly these items (other layers empty) without clothing recolours. */
function wears(outfit: Outfit, items: Partial<Record<WardrobeCategory, string | null>>): boolean {
  for (const c of CLOTHES) {
    if ((outfit[c] ?? null) !== (items[c] ?? null)) return false;
    if (outfit.colors[c]) return false;
  }
  return true;
}

export function isDefaultLook(outfit: Outfit, d: LookData): boolean {
  if (isFemale(outfit)) return !!d.female && wears(outfit, d.female);
  return wears(outfit, d.hero) || !!d.alt?.some(a => wears(outfit, a));
}

/** Full-body image for an outfit (standing), or null. */
export function lookArtFor(outfit: Outfit, d: LookData): LookArtKey | GirlArtKey | null {
  if (isDefaultLook(outfit, d)) return forGender(outfit, 'look-default-hoodie');
  for (const l of d.looks) if (LOOK_ART[l.id] && wears(outfit, l.items)) return forGender(outfit, LOOK_ART[l.id]);
  return null;
}

/** Mode-grid card image of a look for this character set. */
export function lookCardArt(lookId: string, gender: Outfit['gender']): LookArtKey | GirlArtKey | null {
  const k = LOOK_ART[lookId] ?? null;
  return k && gender === 'female' ? `girl/${k}` as GirlArtKey : k;
}

/** Posed image (only the default outfit has pose art; standing works for every look). */
export function poseArtFor(outfit: Outfit, pose: PoseId | 'think' | StickerArtPose, d: LookData): ArtKey | null {
  if (pose === 'stand') return lookArtFor(outfit, d);
  return isDefaultLook(outfit, d) ? forGender(outfit, POSE_ART[pose] ?? null) : null;
}

/** Profile bust portrait (black hoodie): only for the default outfit. */
export function bustArtFor(outfit: Outfit, d: LookData): 'bust' | 'girl/bust' | null { return isDefaultLook(outfit, d) ? forGender(outfit, 'bust') as 'bust' | 'girl/bust' : null; }

/** Sticker → pose image (Hoi!=wave, Top!=thumbsup, Haha=laugh, Yes!=cheer, Peace=peace, Geen idee=shrug, Deal=wink, Wauw!=surprised, Hartje=heart hands, Oké!=OK sign, Sst!=finger on lips, Bel me!=call-me hand). */
export const STICKER_ART: Record<string, PoseArtKey> = {
  hoi: 'pose-wave', top: 'pose-thumbsup', haha: 'pose-laugh', yes: 'pose-cheer', peace: 'pose-peace', 'geen-idee': 'pose-shrug', knipoog: 'pose-wink', wauw: 'pose-surprised', hartje: 'pose-heart',
  oke: 'pose-ok', sst: 'pose-shush', 'bel-me': 'pose-callme',
};

/** Hex colour → [r,g,b] (0–255); null when unparsable. */
function rgb(hex: string | null | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const dist = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Art for ANY outfit (Kast preview): the exact look/start-look image when it matches, otherwise the closest
 * art-backed look — never null, so the editor never falls back to the 3D/2D figure. Closeness: same item ids per
 * layer (outerwear/top/bottom/shoes), then colour distance of the visible upper layer (outerwear, else top) and
 * of the bottom. `colorOf(id)` returns an item's primary colour. Clothing recolours are ignored (art can't recolour).
 */
export function nearestLookArt(outfit: Outfit, d: LookData, colorOf: (id: string) => string | null): ArtKey {
  const exact = lookArtFor({ ...outfit, colors: {} }, d);
  if (exact) return exact;
  const female = isFemale(outfit);
  const start = female ? d.female ?? d.hero : d.hero;
  const cands: { key: ArtKey; items: Partial<Record<WardrobeCategory, string | null>> }[] = [
    { key: forGender(outfit, 'look-default-hoodie')!, items: start },
    ...(female ? [] : (d.alt ?? []).map(items => ({ key: forGender(outfit, 'look-default-hoodie')!, items }))),
    ...d.looks.filter(l => LOOK_ART[l.id]).map(l => ({ key: forGender(outfit, LOOK_ART[l.id])!, items: l.items })),
  ];
  const upper = (o: Partial<Record<WardrobeCategory, string | null>>) => o.outerwear ?? o.top ?? o.dress ?? null;
  const col = (id: string | null | undefined) => (id ? rgb(colorOf(id)) : null);
  let best = cands[0], bestScore = Infinity;
  for (const c of cands) {
    let score = 0;
    // A top under outerwear is hidden, so it barely counts; the visible outerwear dominates.
    const w = { outerwear: 120, top: outfit.outerwear ? 10 : 80, bottom: 80, shoes: 40 };
    for (const k of ['outerwear', 'top', 'bottom', 'shoes'] as const) if ((outfit[k] ?? null) !== (c.items[k] ?? null)) score += w[k];
    const [ua, ub] = [col(upper(outfit)), col(upper(c.items))];
    score += ua && ub ? dist(ua, ub) : 150;
    const [ba, bb] = [col(outfit.bottom ?? outfit.dress), col(c.items.bottom)];
    score += (ba && bb ? dist(ba, bb) : 150) * 0.6;
    if (!!outfit.outerwear !== !!c.items.outerwear) score += 60;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best.key;
}
