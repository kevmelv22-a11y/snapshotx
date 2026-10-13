/**
 * THE round profile picture: a head-and-shoulders crop of exactly the art OutfitArt shows for this outfit
 * (worn art of the last picked item, else the exact/closest look art), on the yellow circle.
 * All full-body art PNGs are trimmed to the figure (~250×700), so the top BUST_FRAC of the image height is
 * head + shoulders (tuned visually on male/female worn + look art, incl. hats and dresses).
 */
import React from 'react';
import { Image, View } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { WORN_ART } from '../../lib/wornArt';
import { ART, nearestLookArt } from './ArtImage';
import { outfitWornKey } from './OutfitArt';

/** Fraction of the art's height shown as the circle's diameter, and top margin (fraction of the diameter). */
export const BUST_FRAC = { male: 0.37, female: 0.37 } as const;
const TOP_PAD = 0.04;

/** Same image source as OutfitArt (worn > nearest look). */
export function bustSourceFor(o: Outfit): { id: string; src: number; w: number; h: number } {
  const worn = outfitWornKey(o);
  if (worn) return { id: `worn:${worn}`, ...WORN_ART[worn] };
  const k = nearestLookArt(o);
  return { id: k, ...ART[k] };
}

export function AvatarBust({ outfit, size, ring = 0, ringColor = '#E6A2EE', label = 'Avatar', testID }: { outfit: Outfit; size: number; ring?: number; ringColor?: string; label?: string; testID?: string }) {
  const a = bustSourceFor(outfit);
  const inner = size - ring * 2;
  const frac = BUST_FRAC[outfit.gender === 'female' ? 'female' : 'male'];
  const h = inner / frac, w = h * a.w / a.h;
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: ringColor, backgroundColor: '#FFE11A', overflow: 'hidden' }} accessibilityLabel={label} testID={testID ?? `avatar-bust:${a.id}`}>
    <Image key={a.id} source={a.src} style={{ position: 'absolute', left: (inner - w) / 2, top: inner * TOP_PAD, width: w, height: h }} resizeMode="stretch" accessibilityIgnoresInvertColors/>
  </View>;
}
