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
import { ComboStack, comboArtId, comboTopY, outfitCombo, outfitWornKey } from './OutfitArt';
import { WORN_BANDS } from '../../lib/avatar/wornBandInfo';

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

/** `composite` forces the band composite (appearance tiles: same clothes art for every tone); `square`/`background` for tiles. */
export function AvatarBust({ outfit, size, ring = 0, ringColor = '#E6A2EE', label = 'Avatar', testID, composite, square, background = '#FFE11A' }: { outfit: Outfit; size: number; ring?: number; ringColor?: string; label?: string; testID?: string; composite?: boolean; square?: boolean; background?: string }) {
  const inner = size - ring * 2;
  const frac = BUST_FRAC[outfit.gender === 'female' ? 'female' : 'male'];
  const combo = outfitCombo(outfit, composite);
  const radius = square ? 0 : size / 2;
  if (combo) {
    // Same composite as the doll: figure height → inner / frac, figure top at TOP_PAD.
    const set = WORN_BANDS[outfit.gender === 'female' ? 'female' : 'male'], c = set.canvas, scale = inner / frac / c.figH;
    // Figure top incl. a hat or a tall Kapsel (like the trimmed worn PNGs): the highest band / style rect.
    const topY = comboTopY(outfit, combo);
    return <View style={{ width: size, height: size, borderRadius: radius, borderWidth: ring, borderColor: ringColor, backgroundColor: background, overflow: 'hidden' }} accessibilityLabel={label} testID={testID ?? `avatar-bust:${comboArtId(outfit, combo)}`}>
      <ComboStack outfit={outfit} layers={combo} scale={scale} left={(inner - c.w * scale) / 2} top={inner * TOP_PAD - topY * scale}/>
    </View>;
  }
  const a = bustSourceFor(outfit);
  const h = inner / frac, w = h * a.w / a.h;
  return <View style={{ width: size, height: size, borderRadius: radius, borderWidth: ring, borderColor: ringColor, backgroundColor: background, overflow: 'hidden' }} accessibilityLabel={label} testID={testID ?? `avatar-bust:${a.id}`}>
    <Image key={a.id} source={a.src} style={{ position: 'absolute', left: (inner - w) / 2, top: inner * TOP_PAD, width: w, height: h }} resizeMode="stretch" accessibilityIgnoresInvertColors/>
  </View>;
}
