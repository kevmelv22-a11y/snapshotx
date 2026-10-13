/**
 * THE art for an outfit, shared by the Kast preview and the Mode look grid/hero so a tile always shows exactly
 * what applying it gives the preview: layered body composite (lib/avatar/bodyLayers) when every layer exists,
 * else the exact/closest look image (nearestLookArt). Once the user picked an item (Outfit.worn), the doll is the
 * COMPOSITE of everything worn (lib/avatar/combo: registered band crops of the worn art).
 */
import React from 'react';
import { Image, View } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { bodyLayersFor, CANVAS } from '../../lib/avatar/bodyLayers';
import { BODY_LAYERS } from './bodyLayerRegistry';
import { ArtImage, nearestLookArt } from './ArtImage';
import { wornArtKey } from '../../lib/avatar/worn';
import { WORN_ART } from '../../lib/wornArt';
import { comboId, comboLayers, type ComboLayer } from '../../lib/avatar/combo';
import { WORN_BANDS } from '../../lib/avatar/wornBandInfo';
import { WORN_BAND_SRC } from '../../lib/wornBands';
import { CATEGORIES } from '../../lib/avatar/outfit';

const AVAILABLE = new Set(Object.keys(BODY_LAYERS));
export const outfitLayers = (o: Outfit) => bodyLayersFor(o, AVAILABLE);
/** Stable id of what OutfitArt draws (for testIDs / tests). */
const WORN = new Set(Object.keys(WORN_ART));
export const outfitWornKey = (o: Outfit) => wornArtKey(o, WORN);
const genderOf = (o: Outfit) => (o.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
/** Composite layers when the user picked an item that is still on (else null: look art as before). */
export function outfitCombo(o: Outfit): ComboLayer[] | null {
  if (!o.worn || !CATEGORIES.some(c => o[c] === o.worn)) return null;
  const layers = comboLayers(o, WORN_BANDS[genderOf(o)], genderOf(o));
  return layers.length ? layers : null;
}
export const outfitArtId = (o: Outfit) => {
  const c = outfitCombo(o); if (c) return comboId(c);
  const w = outfitWornKey(o); return w ? `worn:${w}` : outfitLayers(o)?.join('+') ?? nearestLookArt(o);
};

/** Absolutely positioned band images of a composite; `scale` maps canvas px → dp, (left, top) = canvas origin. */
export function ComboStack({ outfit, layers, scale, left, top }: { outfit: Outfit; layers: ComboLayer[]; scale: number; left: number; top: number }) {
  const g = genderOf(outfit), set = WORN_BANDS[g];
  return <>{layers.map(l => {
    const r = set.items[l.item]?.bands[l.band]; const src = WORN_BAND_SRC[`${g}/${l.item}/${l.band}`];
    if (!r || src == null) return null;
    return <Image key={`${l.item}/${l.band}`} source={src} style={{ position: 'absolute', left: left + r[0] * scale, top: top + r[1] * scale, width: r[2] * scale, height: r[3] * scale }} resizeMode="stretch" accessibilityIgnoresInvertColors/>;
  })}</>;
}
/** Figure scale/origin so a composite fills a width×height box like the other full-body art (lowest band at the bottom). */
export function comboFrame(outfit: Outfit, layers: ComboLayer[], width: number, height: number) {
  const set = WORN_BANDS[genderOf(outfit)], c = set.canvas;
  const rects = layers.map(l => set.items[l.item]?.bands[l.band]).filter((r): r is [number, number, number, number] => !!r);
  const top = Math.min(c.figTop, ...rects.map(r => r[1])), bottom = Math.max(c.figTop + c.figH, ...rects.map(r => r[1] + r[3]));
  const scale = Math.min(height / (bottom - top), width / (c.w - 130));
  return { scale, left: (width - c.w * scale) / 2, top: height - bottom * scale };
}

export function OutfitArt({ outfit, width, height, testID }: { outfit: Outfit; width: number; height: number; testID?: string }) {
  const combo = outfitCombo(outfit);
  if (combo) {
    const f = comboFrame(outfit, combo, width, height);
    return <View style={{ width, height }} pointerEvents="none" testID={testID}><ComboStack outfit={outfit} layers={combo} {...f}/></View>;
  }
  const worn = outfitWornKey(outfit);
  if (worn) {
    const a = WORN_ART[worn], s = Math.min(width / a.w, height / a.h);
    return <View style={{ width, height, alignItems: 'center', justifyContent: 'flex-end' }} pointerEvents="none" testID={testID}>
      <Image key={worn} source={a.src} style={{ width: a.w * s, height: a.h * s }} resizeMode="contain" accessibilityIgnoresInvertColors/>
    </View>;
  }
  const layers = outfitLayers(outfit);
  if (!layers) return <ArtImage art={nearestLookArt(outfit)} width={width} height={height} testID={testID}/>;
  const s = Math.min(width / CANVAS.w, height / CANVAS.h), w = CANVAS.w * s, h = CANVAS.h * s;
  return <View style={{ width, height, overflow: 'hidden' }} pointerEvents="none" testID={testID}>
    {layers.map(k => <Image key={k} source={BODY_LAYERS[k]} style={{ position: 'absolute', left: (width - w) / 2, top: height - h, width: w, height: h }} resizeMode="stretch" accessibilityIgnoresInvertColors/>)}
  </View>;
}
