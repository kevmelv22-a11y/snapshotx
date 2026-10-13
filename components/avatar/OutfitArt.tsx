/**
 * THE art for an outfit, shared by the Kast preview and the Mode look grid/hero so a tile always shows exactly
 * what applying it gives the preview: layered body composite (lib/avatar/bodyLayers) when every layer exists,
 * else the exact/closest look image (nearestLookArt). The worn image of the last picked item (lib/avatar/worn) wins.
 */
import React from 'react';
import { Image, View } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { bodyLayersFor, CANVAS } from '../../lib/avatar/bodyLayers';
import { BODY_LAYERS } from './bodyLayerRegistry';
import { ArtImage, nearestLookArt } from './ArtImage';
import { wornArtKey } from '../../lib/avatar/worn';
import { WORN_ART } from '../../lib/wornArt';

const AVAILABLE = new Set(Object.keys(BODY_LAYERS));
export const outfitLayers = (o: Outfit) => bodyLayersFor(o, AVAILABLE);
/** Stable id of what OutfitArt draws (for testIDs / tests). */
const WORN = new Set(Object.keys(WORN_ART));
export const outfitWornKey = (o: Outfit) => wornArtKey(o, WORN);
export const outfitArtId = (o: Outfit) => { const w = outfitWornKey(o); return w ? `worn:${w}` : outfitLayers(o)?.join('+') ?? nearestLookArt(o); };

export function OutfitArt({ outfit, width, height, testID }: { outfit: Outfit; width: number; height: number; testID?: string }) {
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
