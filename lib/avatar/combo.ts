/**
 * Composite doll: the whole combination of worn items, stacked from registered band crops of the worn art
 * (lib/avatar/wornBandInfo, cut by scripts/worn-bands/build.py). Bottom → top:
 *   sole (legs source, only without own shoes) · legs (bottom, or a dress / long coat) · feet (shoes) · torso (base) · head (hat, else base)
 * Base = the last picked torso item (Outfit.torso) while worn, else outer layer, else dress, else top, else the gender's reference. Missing art for an item → base band.
 * Pure (type-only imports) so it runs under `node --test`.
 */
import type { Outfit } from './outfit';
import type { Band, BandSet } from './wornBandInfo';

export const COMBO_REF = { male: 'top-blueberry-white-tee', female: 'top-nike-black-tee' } as const;
/** Hats whose look IS the base head art (every female worn image already wears the black start cap). */
const BASE_HEAD: Record<'male' | 'female', readonly string[]> = { male: [], female: ['hat-nike-cap'] };
export type ComboLayer = { item: string; band: Band };

export function comboLayers(o: Outfit, set: BandSet, gender: 'male' | 'female'): ComboLayer[] {
  const has = (id: string | null | undefined, b: Band): id is string => !!id && !!set.items[id]?.bands[b];
  const torso = o.torso && [o.outerwear, o.dress, o.top].includes(o.torso) ? o.torso : null;
  const base = [torso, o.outerwear, o.dress, o.top].find(id => has(id, 'torso')) ?? COMBO_REF[gender];
  const bi = set.items[base];
  const legs = bi?.cat === 'dress' || bi?.long ? base : has(o.dress, 'legs') ? o.dress : has(o.bottom, 'legs') ? o.bottom : base;
  const feet = has(o.shoes, 'feet') ? o.shoes : null;
  const head = has(o.hat, 'head') && !BASE_HEAD[gender].includes(o.hat) ? o.hat : base;
  const out: ComboLayer[] = [];
  if (!feet && has(legs, 'sole')) out.push({ item: legs, band: 'sole' });
  if (has(legs, 'legs')) out.push({ item: legs, band: 'legs' });
  if (feet) out.push({ item: feet, band: 'feet' });
  if (has(base, 'torso')) out.push({ item: base, band: 'torso' });
  if (has(head, 'head')) out.push({ item: head, band: 'head' });
  return out;
}

/** Stable id of a composite (testIDs): `combo:<item>.<band>+...`. */
export const comboId = (layers: ComboLayer[]) => 'combo:' + layers.map(l => `${l.item}.${l.band}`).join('+');
