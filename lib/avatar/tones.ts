/**
 * Skin tones and hair colours of the band-composited avatar (lib/avatar/combo). The worn art is drawn in one skin
 * tone ('warm') and one hair colour per character set (male dark brown, female blonde); every other choice is a
 * recoloured overlay per band (scripts/worn-bands/tones.py → lib/avatar/wornToneInfo). Stored as hex in
 * Outfit.colors.skin / .hair (same palettes as the classic editor, lib/avatar/appearance CLASSIC_SKIN / CLASSIC_HAIR).
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Gender, Outfit } from './outfit';

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
/** The one hairstyle each character set's art has (more styles need new base art). */
export const ART_HAIRSTYLE: Record<Gender, { id: 'curly' | 'wavy'; label: string }> = { male: { id: 'curly', label: 'Krullen' }, female: { id: 'wavy', label: 'Lang golvend' } };

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
/** Overlay keys to draw over each band ('s-<tone>' / 'h-<colour>'); empty when the outfit shows the art as drawn. */
export function toneKeys(o: Outfit): string[] {
  const s = skinToneOf(o), h = hairColorOf(o), out: string[] = [];
  if (s !== ART_SKIN) out.push(`s-${s}`);
  if (h !== ART_HAIR[genderOf(o)]) out.push(`h-${h}`);
  return out;
}
/** Whether the user picked a skin tone / hair colour (a palette value): then the composited (band) art is shown,
 *  also for the art's own tone, so switching tones never swaps the clothes art underneath. */
export const hasToneChoice = (o: Outfit) =>
  SKIN_TONES.some(t => eq(o.colors.skin, t.hex)) || HAIR_COLORS.some(t => eq(o.colors.hair, t.hex));
/** `o` with the skin tone / hair colour the user picked on `from` (looks, start look and character switches keep them). */
export function withAppearance(o: Outfit, from: Outfit): Outfit {
  const skin = SKIN_TONES.find(t => eq(from.colors.skin, t.hex))?.hex, hair = HAIR_COLORS.find(t => eq(from.colors.hair, t.hex))?.hex;
  if (!skin && !hair) return o;
  return { ...o, colors: { ...o.colors, ...(skin ? { skin } : {}), ...(hair ? { hair } : {}) } };
}
