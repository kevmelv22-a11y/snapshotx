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
import { comboId, comboLayers, comboStyle, type ComboLayer } from '../../lib/avatar/combo';
import { WORN_BANDS } from '../../lib/avatar/wornBandInfo';
import { WORN_BAND_SRC } from '../../lib/wornBands';
import { CATEGORIES } from '../../lib/avatar/outfit';
import { hairColorOf, hasToneChoice, skinToneOf, toneKeys, ART_SKIN } from '../../lib/avatar/tones';
import { WORN_STYLES } from '../../lib/avatar/wornStyleInfo';
import { WORN_STYLE_SRC } from '../../lib/wornStyles';
import { WORN_TONES } from '../../lib/avatar/wornToneInfo';
import { WORN_TONE_SRC } from '../../lib/wornTones';

const AVAILABLE = new Set(Object.keys(BODY_LAYERS));
export const outfitLayers = (o: Outfit) => bodyLayersFor(o, AVAILABLE);
/** Stable id of what OutfitArt draws (for testIDs / tests). */
const WORN = new Set(Object.keys(WORN_ART));
export const outfitWornKey = (o: Outfit) => wornArtKey(o, WORN);
const genderOf = (o: Outfit) => (o.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
/** Composite layers when the user picked an item that is still on, or picked a skin tone / hair colour the
 *  pre-rendered look art cannot show (else null: look art as before). */
export function outfitCombo(o: Outfit, force = false): ComboLayer[] | null {
  if (!force && !hasToneChoice(o) && (!o.worn || !CATEGORIES.some(c => o[c] === o.worn))) return null;
  const layers = comboLayers(o, WORN_BANDS[genderOf(o)], genderOf(o));
  return layers.length ? layers : null;
}
const styleOf = (o: Outfit, layers: ComboLayer[]) => { const g = genderOf(o); return comboStyle(o, layers, WORN_BANDS[g], Object.keys(WORN_STYLES[g].styles)); };
/** Id of a composite incl. Kapsel and tone overlays (testIDs). */
export const comboArtId = (o: Outfit, c: ComboLayer[]) => { const st = styleOf(o, c); return [comboId(c), ...(st ? [`style-${st}`] : []), ...toneKeys(o)].join('~'); };
/** Highest canvas y the composite draws (a hat band or a Kapsel layer can reach above the figure top). */
export function comboTopY(o: Outfit, c: ComboLayer[]) {
  const g = genderOf(o), set = WORN_BANDS[g], st = styleOf(o, c);
  return Math.min(...c.map(l => set.items[l.item]?.bands[l.band]?.[1] ?? set.canvas.figTop), ...(st ? [WORN_STYLES[g].styles[st].rect[1]] : []));
}
export const outfitArtId = (o: Outfit) => {
  const c = outfitCombo(o); if (c) return comboArtId(o, c);
  const w = outfitWornKey(o); return w ? `worn:${w}` : outfitLayers(o)?.join('+') ?? nearestLookArt(o);
};

/** Absolutely positioned band images of a composite; `scale` maps canvas px → dp, (left, top) = canvas origin. */
export function ComboStack({ outfit, layers, scale, left, top }: { outfit: Outfit; layers: ComboLayer[]; scale: number; left: number; top: number }) {
  const g = genderOf(outfit), set = WORN_BANDS[g], keys = toneKeys(outfit), style = styleOf(outfit, layers);
  const img = (key: string, src: number, x: number, y: number, w: number, h: number) =>
    <Image key={key} source={src} style={{ position: 'absolute', left: left + x * scale, top: top + y * scale, width: w * scale, height: h * scale }} resizeMode="stretch" accessibilityIgnoresInvertColors/>;
  return <>{layers.map(l => {
    const r = set.items[l.item]?.bands[l.band]; const src = WORN_BAND_SRC[`${g}/${l.item}/${l.band}`];
    if (!r || src == null) return null;
    if (style && l.band === 'head') {
      // Kapsel: the head band without its old face + hair (neck extended up), then the style's head + hair, both
      // recoloured: the style hair is always recoloured (its drawn colour is no palette colour).
      const S = WORN_STYLES[g], k = S.keep[l.item], st = S.styles[style], skin = skinToneOf(outfit);
      const sk = skin === ART_SKIN ? [] : [`s-${skin}`], ksrc = WORN_STYLE_SRC[`${g}/keep/${l.item}`], ssrc = WORN_STYLE_SRC[`${g}/style/${style}`];
      return <React.Fragment key={`${l.item}/${l.band}`}>
        {k && ksrc != null && img('keep', ksrc, r[0] + k.rect[0], r[1] + k.rect[1], k.rect[2], k.rect[3])}
        {k && ksrc != null && sk.map(t => { const o = k.tones[t], os = WORN_STYLE_SRC[`${g}/keep/${l.item}/${t}`]; return o && os != null ? img(`keep-${t}`, os, r[0] + o[0], r[1] + o[1], o[2], o[3]) : null; })}
        {ssrc != null && img('style', ssrc, st.rect[0], st.rect[1], st.rect[2], st.rect[3])}
        {[...sk, `h-${hairColorOf(outfit)}`].map(t => { const o = st.tones[t], os = WORN_STYLE_SRC[`${g}/style/${style}/${t}`]; return o && os != null ? img(`style-${t}`, os, st.rect[0] + o[0], st.rect[1] + o[1], o[2], o[3]) : null; })}
      </React.Fragment>;
    }
    // Skin tone / hair colour: recoloured overlays drawn right over their band (rect inside the band image).
    const tones = WORN_TONES[g][`${l.item}/${l.band}`];
    return <React.Fragment key={`${l.item}/${l.band}`}>
      <Image source={src} style={{ position: 'absolute', left: left + r[0] * scale, top: top + r[1] * scale, width: r[2] * scale, height: r[3] * scale }} resizeMode="stretch" accessibilityIgnoresInvertColors/>
      {tones && keys.map(k => {
        const o = tones[k], osrc = WORN_TONE_SRC[`${g}/${l.item}/${l.band}/${k}`];
        if (!o || osrc == null) return null;
        return <Image key={k} source={osrc} style={{ position: 'absolute', left: left + (r[0] + o[0]) * scale, top: top + (r[1] + o[1]) * scale, width: o[2] * scale, height: o[3] * scale }} resizeMode="stretch" accessibilityIgnoresInvertColors/>;
      })}
    </React.Fragment>;
  })}</>;
}
/** Figure scale/origin so a composite fills a width×height box like the other full-body art (lowest band at the bottom). */
export function comboFrame(outfit: Outfit, layers: ComboLayer[], width: number, height: number) {
  const set = WORN_BANDS[genderOf(outfit)], c = set.canvas;
  const rects = layers.map(l => set.items[l.item]?.bands[l.band]).filter((r): r is [number, number, number, number] => !!r);
  const top = Math.min(c.figTop, comboTopY(outfit, layers)), bottom = Math.max(c.figTop + c.figH, ...rects.map(r => r[1] + r[3]));
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
