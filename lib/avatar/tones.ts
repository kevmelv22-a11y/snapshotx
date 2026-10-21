/**
 * Skin tones and hair colours of the band-composited avatar (lib/avatar/combo). The worn art is drawn in one skin
 * tone ('warm') and one hair colour per character set (male dark brown, female blonde); every other choice is a
 * recoloured overlay per band (scripts/worn-bands/tones.py → lib/avatar/wornToneInfo). Stored as hex in
 * Outfit.colors.skin / .hair (same palettes as the classic editor, lib/avatar/appearance CLASSIC_SKIN / CLASSIC_HAIR).
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Gender, HairStyle, Outfit } from './outfit';

export type SkinTone = 'light' | 'warm' | 'tan' | 'brown' | 'dark';
export type HairColor = 'black' | 'darkbrown' | 'brown' | 'blonde' | 'auburn';

export const SKIN_TONES: readonly { id: SkinTone; label: string; hex: string }[] = [
  { id: 'light', label: 'Licht', hex: '#EBC5A3' },
  { id: 'warm', label: 'Warm', hex: '#F2BE91' },
  { id: 'tan', label: 'Getint', hex: '#CE9E79' },
  { id: 'brown', label: 'Bruin', hex: '#A9775D' },
  { id: 'dark', label: 'Donker', hex: '#744737' },
];
export const HAIR_COLORS: readonly { id: HairColor; label: string; hex: string }[] = [
  { id: 'black', label: 'Zwart', hex: '#24212F' },
  { id: 'darkbrown', label: 'Donkerbruin', hex: '#4D302C' },
  { id: 'brown', label: 'Bruin', hex: '#70442E' },
  { id: 'blonde', label: 'Blond', hex: '#BC873D' },
  { id: 'auburn', label: 'Rood', hex: '#A8512C' },
];
/** Tone / colour the art itself is drawn in (no overlay needed). */
export const ART_SKIN: SkinTone = 'warm';
export const ART_HAIR: Record<Gender, HairColor> = { male: 'darkbrown', female: 'blonde' };
/** The hairstyle each character set's art is drawn with (default; no style layer). */
export const ART_HAIRSTYLE: Record<Gender, { id: 'curly' | 'wavy'; label: string }> = { male: { id: 'curly', label: 'Krullen' }, female: { id: 'wavy', label: 'Lang golvend' } };
/** Kapsel options per character set, art style first. The others are generated head + hair layers registered on the
 *  reference head (scripts/worn-bands/hairstyles.py → lib/avatar/wornStyleInfo), stored in Outfit.hairStyle.
 *  Female: the reference art re-drawn with the new hair; its long art hair is baked into the top bands, so a style shows
 *  with the clothes that have hair-free bands (scripts/worn-bands/female, lib/avatar/combo comboStyle `supports`). */
export const HAIRSTYLES: Record<Gender, readonly { id: HairStyle; label: string }[]> = {
  male: [ART_HAIRSTYLE.male, { id: 'short', label: 'Kort' }, { id: 'wavy', label: 'Golvend' }, { id: 'buzz', label: 'Fade' }, { id: 'afro', label: 'Afro' }],
  female: [ART_HAIRSTYLE.female, { id: 'long', label: 'Lang stijl' }, { id: 'bun', label: 'Knot' }, { id: 'short', label: 'Bob' }],
};

const genderOf = (o: Pick<Outfit, 'gender'>): Gender => (o.gender === 'female' ? 'female' : 'male');
const eq = (a: string | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

/** Skin tone of an outfit: exact palette hex, else the art tone (old / default values such as DEFAULT_SKIN). */
export function skinToneOf(o: Outfit): SkinTone {
  return SKIN_TONES.find(t => eq(o.colors.skin, t.hex))?.id ?? ART_SKIN;
}
/** Hair colour of an outfit: exact palette hex, else the character set's art colour (DEFAULT_HAIR, female start blonde...). */
export function hairColorOf(o: Outfit): HairColor {
  return HAIR_COLORS.find(t => eq(o.colors.hair, t.hex))?.id ?? ART_HAIR[genderOf(o)];
}
export function withSkinTone(o: Outfit, tone: SkinTone): Outfit {
  return { ...o, colors: { ...o.colors, skin: SKIN_TONES.find(t => t.id === tone)!.hex } };
}
export function withHairColor(o: Outfit, color: HairColor): Outfit {
  return { ...o, colors: { ...o.colors, hair: HAIR_COLORS.find(t => t.id === color)!.hex } };
}
/** Kapsel of an outfit: its hairStyle when the character set has it, else the art style (classic / other set's values). */
export function hairStyleOf(o: Pick<Outfit, 'gender' | 'hairStyle'>): HairStyle {
  const g = genderOf(o);
  return HAIRSTYLES[g].some(h => h.id === o.hairStyle) ? o.hairStyle : ART_HAIRSTYLE[g].id;
}
/** Style layer to draw instead of the art's own head, or null for the art style. */
export function styleLayerOf(o: Pick<Outfit, 'gender' | 'hairStyle'>): HairStyle | null {
  const h = hairStyleOf(o);
  return h === ART_HAIRSTYLE[genderOf(o)].id ? null : h;
}
export function withHairStyle(o: Outfit, style: HairStyle): Outfit {
  return { ...o, hairStyle: style };
}
/** Overlay keys to draw over each band ('s-<tone>' / 'h-<colour>'); empty when the outfit shows the art as drawn. */
export function toneKeys(o: Outfit): string[] {
  const s = skinToneOf(o), h = hairColorOf(o), out: string[] = [];
  if (s !== ART_SKIN) out.push(`s-${s}`);
  if (h !== ART_HAIR[genderOf(o)]) out.push(`h-${h}`);
  return out;
}
/** Whether the user picked a skin tone / hair colour (a palette value) or a Kapsel: then the composited (band) art is
 *  shown, also for the art's own tone, so switching tones never swaps the clothes art underneath. */
export const hasToneChoice = (o: Outfit) =>
  SKIN_TONES.some(t => eq(o.colors.skin, t.hex)) || HAIR_COLORS.some(t => eq(o.colors.hair, t.hex)) || styleLayerOf(o) !== null;
/** `o` with the skin tone / hair colour / Kapsel the user picked on `from` (looks, start look and character switches
 *  keep them; a Kapsel only when `o`'s character set has it). */
export function withAppearance(o: Outfit, from: Outfit): Outfit {
  const skin = SKIN_TONES.find(t => eq(from.colors.skin, t.hex))?.hex, hair = HAIR_COLORS.find(t => eq(from.colors.hair, t.hex))?.hex;
  const style = styleLayerOf(from), keepStyle = !!style && style !== ART_HAIRSTYLE[genderOf(o)].id && HAIRSTYLES[genderOf(o)].some(h => h.id === style);
  if (!skin && !hair && !keepStyle) return o;
  return { ...o, ...(keepStyle ? { hairStyle: style } : {}), colors: { ...o.colors, ...(skin ? { skin } : {}), ...(hair ? { hair } : {}) } };
}
