/**
 * Composite doll: the whole combination of worn items, stacked from registered band crops of the worn art
 * (lib/avatar/wornBandInfo, cut by scripts/worn-bands/build.py). Bottom → top:
 *   sole (legs source, only without own shoes) · legs (bottom, or a dress / long coat; 'legsn' under a long-hem shirt) · feet (shoes) · torso (base) · head (hat, else base)
 * Open jacket over a top (unless the top was picked last): top 'under' (chest only; else torso) + outer 'jacket' cutout.
 * Base = the last picked torso item (Outfit.torso) while worn, else outer layer, else dress, else top, else the gender's reference. Missing art for an item → base band.
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit } from './outfit';
import type { Band, BandSet } from './wornBandInfo';
import { styleLayerOf } from './tones';

export const COMBO_REF = { male: 'top-blueberry-white-tee', female: 'top-nike-black-tee' } as const;
/** Hats whose look IS the base head art (every female worn image already wears the black start cap). */
const BASE_HEAD: Record<'male' | 'female', readonly string[]> = { male: [], female: ['hat-nike-cap'] };
export type ComboLayer = { item: string; band: Band };

export function comboLayers(o: Outfit, set: BandSet, gender: 'male' | 'female'): ComboLayer[] {
  const has = (id: string | null | undefined, b: Band): id is string => !!id && !!set.items[id]?.bands[b];
  const inner = [o.dress, o.top].find(id => has(id, 'torso')) ?? null;
  const outer = has(o.outerwear, 'torso') ? o.outerwear : null;
  const lastInner = !!o.torso && o.torso === inner;
  // An open jacket over a worn top: the top's torso + the jacket-only cutout of the outer layer.
  let base: string, jacket: string | null = null;
  if (outer && inner && !lastInner && has(outer, 'jacket')) { base = inner; jacket = outer; }
  else if (outer && !lastInner) base = outer;
  else base = inner ?? COMBO_REF[gender];
  const own = jacket ?? base;
  const oi = set.items[own], bi = set.items[base];
  const legs = oi?.cat === 'dress' || oi?.long ? own : bi?.cat === 'dress' ? base : has(o.bottom, 'legs') ? o.bottom : base;
  const feet = has(o.shoes, 'feet') ? o.shoes : null;
  const head = has(o.hat, 'head') && !BASE_HEAD[gender].includes(o.hat) ? o.hat : own;
  const out: ComboLayer[] = [];
  if (!feet && has(legs, 'sole')) out.push({ item: legs, band: 'sole' });
  // A football shirt hangs to its own hem: trousers use their narrow-waist variant so no hip pokes out beside the shirt.
  const torsoTop = jacket ? null : base;
  const narrow = !!torsoTop && !!set.items[torsoTop]?.hem && legs === o.bottom && has(legs, 'legsn');
  if (narrow) out.push({ item: legs, band: 'legsn' });
  else if (has(legs, 'legs')) out.push({ item: legs, band: 'legs' });
  if (feet) out.push({ item: feet, band: 'feet' });
  // Under an open jacket the top contributes only its chest ('under': no arms/hands/hair that would poke out around the jacket).
  if (jacket && has(base, 'under')) out.push({ item: base, band: 'under' });
  else if (has(base, 'torso')) out.push({ item: base, band: 'torso' });
  if (jacket) out.push({ item: jacket, band: 'jacket' });
  if (has(head, 'head')) out.push({ item: head, band: 'head' });
  return out;
}

/** Stable id of a composite (testIDs): `combo:<item>.<band>+...`. */
export const comboId = (layers: ComboLayer[]) => 'combo:' + layers.map(l => `${l.item}.${l.band}`).join('+');

/** Kapsel layer replacing the head band's own face + hair (lib/avatar/tones styleLayerOf), or null: art style, or a
 *  hat on the head (hats win; the female start cap counts as no hat and is dropped with a style). `available`: the
 *  styles that have a layer for this character set. `supports(item, band)` (female): whether the item has hair-free art
 *  for that band ('head' = keep band; torso / under / jacket = clean band). The female art bakes its long hair into
 *  the top bands, so with clothes that have no hair-free version the art hair stays (null). */
export function comboStyle(o: Outfit, layers: ComboLayer[], set: BandSet, available: readonly string[], supports?: (item: string, band: Band) => boolean): string | null {
  const style = styleLayerOf(o), head = layers.find(l => l.band === 'head');
  if (!style || !head || set.items[head.item]?.cat === 'hat' || !available.includes(style)) return null;
  if (supports && !layers.every(l => !HAIR_BANDS.includes(l.band) || supports(l.item, l.band))) return null;
  return style;
}
/** Bands whose female art carries the long hair (head: face + hair; torso / under / jacket: the hair over the shoulders). */
export const HAIR_BANDS: readonly Band[] = ['head', 'torso', 'under', 'jacket'];
/** Why a picked Kapsel is not drawn: a hat on the head, or (female) clothes without hair-free art; null when it is drawn
 *  or no Kapsel is picked. */
export function kapselBlocked(o: Outfit, layers: ComboLayer[], set: BandSet, available: readonly string[], supports?: (item: string, band: Band) => boolean): 'hat' | 'clothes' | null {
  const style = styleLayerOf(o); if (!style || !available.includes(style)) return null;
  const head = layers.find(l => l.band === 'head');
  if (head && set.items[head.item]?.cat === 'hat') return 'hat';
  return comboStyle(o, layers, set, available, supports) ? null : 'clothes';
}
