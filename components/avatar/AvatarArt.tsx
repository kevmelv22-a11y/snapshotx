/**
 * Layered vector art for the Avatar-kast: full-body avatar parts + item previews.
 * Original artwork (no third-party logos); every clothing layer is driven by the outfit and recolourable.
 * Coordinate system: viewBox 0 0 200 400, body centred on x=100, feet at y≈350.
 */
import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { shade, mix, luminance } from '../../lib/avatar/color';
import { DEFAULT_HAIR, type HairStyle, type Outfit, type WardrobeCategory, type WardrobeItem } from '../../lib/avatar/outfit';
import { ITEMS_BY_ID } from '../../lib/avatar/wardrobeItems';

// ------------------------------------------------------------------ look model
export type Worn = { item: WardrobeItem; c: [string, string, string] };
export type Look = {
  skin: string;
  hair: string;
  /** Sun-bleached blonde tips (default hair only; a custom hair colour is shown more evenly). */
  tips?: boolean;
  hairStyle?: HairStyle;
  mannequin: boolean;
  items: Partial<Record<WardrobeCategory, Worn>>;
};
export type Expression = 'neutral' | 'smile';
export type Gaze = 'front' | 'down' | 'side';
export type HandPose = 'rest' | 'peace';

export const SKIN = '#DD9A72';
const MANNEQUIN = '#C7C7CC';

function worn(item: WardrobeItem, override?: string): Worn {
  const [a, b, c] = item.colors;
  const primary = override ?? a ?? '#888888';
  return { item, c: [primary, b ?? shade(primary, -0.25), c ?? shade(primary, 0.3)] };
}

export function lookFromOutfit(outfit: Outfit): Look {
  const items: Look['items'] = {};
  for (const key of Object.keys(outfit) as (keyof Outfit)[]) {
    if (key === 'colors' || key === 'hairStyle') continue;
    const id = outfit[key];
    const item = id ? ITEMS_BY_ID.get(id) : undefined;
    if (item) items[item.category] = worn(item, outfit.colors[item.category]);
  }
  return { skin: outfit.colors.skin ?? SKIN, hair: outfit.colors.hair ?? DEFAULT_HAIR, tips: !outfit.colors.hair, hairStyle: outfit.hairStyle ?? 'curly', mannequin: false, items };
}

// ------------------------------------------------------------------ defs
function patternDefs(p: string, layer: string, w: Worn) {
  const [c0, c1, c2] = w.c;
  const id = `${p}pat-${layer}`;
  switch (w.item.preview.pattern) {
    case 'plaid': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="12" height="12"><Rect width="12" height="12" fill={c0}/><Rect width="12" height="5" fill={c1} opacity={0.75}/><Rect width="5" height="12" fill={c1} opacity={0.75}/><Rect x="7" width="1" height="12" fill={c1} opacity={0.4}/></Pattern>;
    case 'stripes': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="20" height="14"><Rect width="20" height="14" fill={c0}/><Rect y="2" width="20" height="6" fill={c1}/><Rect y="9.5" width="20" height="1.2" fill={c2}/></Pattern>;
    case 'roses': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="26" height="26"><Rect width="26" height="26" fill={c0}/>
      <G><Circle cx="8" cy="8" r="5.2" fill={c1}/><Path d="M5.5 8a2.6 2.6 0 1 1 2.6 2.6M7 7.5a1.2 1.2 0 1 1 1.2 1.2" stroke={c0} strokeWidth="0.7" fill="none"/><Path d="M3 12q-3 3-1 6q3-2 2-5Z M13 11q4 1 5 4q-4 0-5-3Z" fill={c1}/></G>
      <G><Circle cx="20" cy="20" r="4.4" fill={c1}/><Path d="M18 20a2.1 2.1 0 1 1 2.1 2.1" stroke={c0} strokeWidth="0.7" fill="none"/><Path d="M16 24q-2 3 1 4q1-3-1-4Z" fill={c1}/></G>
      <Path d="M14 2l1 3M2 20l3 1M24 6l-2 2" stroke={c1} strokeWidth="0.8"/></Pattern>;
    case 'camo': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="34" height="34"><Rect width="34" height="34" fill={c0}/><Path d="M2 4q8-4 12 2t-4 10q-10 2-8-12Z M20 18q8-3 12 3t-6 9q-9 0-6-12Z" fill={c1}/><Path d="M18 2q6 0 7 5t-6 4q-5-4-1-9Z M4 22q5-2 8 3t-5 6q-6-3-3-9Z" fill={c2}/></Pattern>;
    case 'baroque': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="20" height="20"><Rect width="20" height="20" fill={c0}/><Path d="M2 10q4-8 8 0t8 0M10 2q-3 4 0 8t0 8" stroke={c1} strokeWidth="1.5" fill="none"/><Circle cx="10" cy="10" r="1.6" fill={c1}/></Pattern>;
    case 'quilt': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="40" height="11"><Rect width="40" height="11" fill={c0}/><Rect y="0" width="40" height="4" fill="#FFFFFF" opacity={0.08}/><Rect y="9.6" width="40" height="1.4" fill={luminance(c0) > 0.5 ? shade(c0, -0.25) : shade(c0, 0.18)}/></Pattern>;
    case 'hearts': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="14" height="14"><Rect width="14" height="14" fill={c0}/><Path d="M7 11 3.5 7.5a2 2 0 0 1 3.5-2.4 2 2 0 0 1 3.5 2.4Z" fill={c1}/></Pattern>;
    case 'wrap': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="12" height="12"><Rect width="12" height="12" fill={c0}/><Path d="M-2 4 14 -1M-2 10 14 5M-2 16 14 11" stroke={c1} strokeWidth="1.4"/></Pattern>;
    case 'swirl': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="22" height="22"><Rect width="22" height="22" fill={c0}/><Path d="M0 6q5.5-6 11 0t11 0M0 17q5.5-6 11 0t11 0" stroke={c1} strokeWidth="2.6" fill="none"/><Circle cx="11" cy="11.5" r="1.6" fill={c2}/></Pattern>;
    case 'patches': return <Pattern key={id} id={id} patternUnits="userSpaceOnUse" width="34" height="34"><Rect width="34" height="34" fill={c0}/><Path d="m8 4 1.6 3.4 3.7.4-2.8 2.5.8 3.6L8 12.1l-3.3 1.8.8-3.6-2.8-2.5 3.7-.4Z" fill="#F2C94C"/><Rect x="20" y="18" width="9" height="10" rx="2" fill={c1}/><Path d="M22.5 20.5h4v5h-4Z" fill={c2}/><Circle cx="9" cy="25" r="4" fill={c2}/><Path d="M7 25h4" stroke={c1} strokeWidth="1.2"/></Pattern>;
    default: return null;
  }
}

export function LookDefs({ p, look }: { p: string; look: Look }) {
  const hair = look.hair;
  return <Defs>
    <LinearGradient id={`${p}cyl`} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#000" stopOpacity={0.42}/><Stop offset="0.22" stopColor="#000" stopOpacity={0.08}/>
      <Stop offset="0.42" stopColor="#FFF" stopOpacity={0.14}/><Stop offset="0.62" stopColor="#000" stopOpacity={0}/>
      <Stop offset="1" stopColor="#000" stopOpacity={0.46}/>
    </LinearGradient>
    <LinearGradient id={`${p}vsh`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#FFF" stopOpacity={0.12}/><Stop offset="0.5" stopColor="#000" stopOpacity={0}/><Stop offset="1" stopColor="#000" stopOpacity={0.28}/>
    </LinearGradient>
    <LinearGradient id={`${p}hair`} x1="0.2" y1="0" x2="0.5" y2="1">
      <Stop offset="0" stopColor={look.tips ? mix(hair, '#F3D58E', 0.62) : shade(hair, 0.3)}/><Stop offset="0.38" stopColor={look.tips ? mix(hair, '#D9A855', 0.22) : hair}/><Stop offset="0.75" stopColor={shade(hair, -0.25)}/><Stop offset="1" stopColor={shade(hair, -0.55)}/>
    </LinearGradient>
    {/* 'Lang' fringe + front locks share ONE user-space (vertical, so mirror-safe) gradient: overlapping parts get the
        exact same colour where they meet. Per-shape objectBoundingBox gradients gave the lock top a lighter colour
        than the fringe edge above it, which read as a seam at the hairline. */}
    <LinearGradient id={`${p}hairY`} gradientUnits="userSpaceOnUse" x1="100" y1="25" x2="100" y2="125">
      <Stop offset="0" stopColor={look.tips ? mix(hair, '#F3D58E', 0.62) : shade(hair, 0.3)}/><Stop offset="0.17" stopColor={look.tips ? mix(hair, '#D9A855', 0.22) : hair}/><Stop offset="0.36" stopColor={shade(hair, -0.25)}/><Stop offset="1" stopColor={shade(hair, -0.55)}/>
    </LinearGradient>
    <RadialGradient id={`${p}face`} cx="0.4" cy="0.34" r="0.75">
      <Stop offset="0" stopColor="#FFF" stopOpacity={0.26}/><Stop offset="0.5" stopColor="#FFF" stopOpacity={0}/><Stop offset="1" stopColor="#000" stopOpacity={0.24}/>
    </RadialGradient>
    <LinearGradient id={`${p}gold`} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#FFF1B8"/><Stop offset="0.45" stopColor="#D9A934"/><Stop offset="1" stopColor="#8A6216"/>
    </LinearGradient>
    <LinearGradient id={`${p}lens`} x1="0" y1="0" x2="0.4" y2="1">
      <Stop offset="0" stopColor="#5B6170"/><Stop offset="0.5" stopColor="#15161A"/><Stop offset="1" stopColor="#000"/>
    </LinearGradient>
    {Object.entries(look.items).map(([layer, w]) => w ? patternDefs(p, layer, w) : null)}
  </Defs>;
}

// ------------------------------------------------------------------ primitives
type Ctx = { p: string; look: Look };
const MIRROR = 'translate(200 0) scale(-1 1)';

function paint(ctx: Ctx, layer: WardrobeCategory): string {
  const w = ctx.look.items[layer];
  if (!w) return '#888';
  return w.item.preview.pattern && w.item.preview.pattern !== 'plain' ? `url(#${ctx.p}pat-${layer})` : w.c[0];
}

function Cloth({ d, fill, ctx, v = true, edge = 0.22 }: { d: string; fill: string; ctx: Ctx; v?: boolean; edge?: number }) {
  return <>
    <Path d={d} fill={fill}/>
    <Path d={d} fill={`url(#${ctx.p}cyl)`}/>
    {v && <Path d={d} fill={`url(#${ctx.p}vsh)`}/>}
    {edge > 0 && <Path d={d} fill="none" stroke="#000" strokeOpacity={edge} strokeWidth={0.7}/>}
  </>;
}

function Both({ children }: { children: React.ReactNode }) {
  return <>{children}<G transform={MIRROR}>{children}</G></>;
}

function AccentStripe({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return <Path transform={`translate(${x} ${y}) scale(${s})`} d="M-7 4 L6 -4 L8 -1 L-5 7 Z" fill={color}/>;
}

// ------------------------------------------------------------------ body geometry
const LEG = 'M74 204 L99 204 L97.5 300 L95.5 340 L80.5 340 L77 300 Z';
const TORSO_SKIN = 'M70 121 C82 114 118 114 130 121 L135 131 L133 205 Q100 211 67 205 L65 131 Z';
const NECK = 'M90.5 94 L109.5 94 L110.5 121 Q100 128 89.5 121 Z';
const TEE = 'M68 119 C82 111 118 111 132 119 L137 132 L135 210 Q100 216 65 210 L63 132 Z';
const TANK = 'M80 116 Q100 134 120 116 L130 127 L134 210 Q100 216 66 210 L70 127 Z';
const PANTS_WIDE = 'M66 198 Q100 204 134 198 L136.5 264 L135.5 327 Q119 330 103 327 L100 228 L97 327 Q81 330 64.5 327 L63.5 264 Z';
const JOGGERS = 'M67 198 Q100 204 133 198 L135 262 L127 320 L104 320 L100 228 L96 320 L73 320 L65 262 Z';
const SHORTS = 'M66 198 Q100 204 134 198 L139 262 Q120 266 104 264 L100 236 L96 264 Q80 266 61 262 Z';
const SKIRT = 'M68 198 Q100 204 132 198 L146 276 Q100 286 54 276 Z';
const OUT_BODY = 'M65 118 C80 109 120 109 135 118 L141 132 L139 203 Q100 209 61 203 L59 132 Z';
const OUT_LEFT = 'M65 118 C75 111 87 110 96.5 114 L97.5 205 Q78 208 61 204 L59 132 Z';
const PUFFER = 'M62 117 C78 105 122 105 138 117 L145 132 L143 207 Q100 215 57 207 L55 132 Z';

const ARM_SKIN = 'M62 130 Q63 121 70 121 Q77 121 77 130 L69.5 168 L64.5 206 L52.5 206 L55.5 168 Z';
const SLEEVE_LONG = 'M59.5 129 Q60.5 118.5 70 118.5 Q79.5 118.5 79.5 129 L71.5 168 L66.5 202 L50.5 202 L54 168 Z';
const SLEEVE_PUFF = 'M56 128 Q57 115 70 115 Q83 115 83 128 L75 168 L69 203 L48 203 L51 168 Z';
const SLEEVE_SHORT = 'M59 129 Q60 118 70 118 Q80 118 80 129 L76.5 161 Q65 165.5 53.5 160.5 Z';

// ------------------------------------------------------------------ chest graphics
function Graphic({ w, kind, ctx, x = 100, y = 150 }: { w: Worn; kind: NonNullable<WardrobeItem['preview']['graphic']>; ctx: Ctx; x?: number; y?: number }) {
  const ink = w.c[1];
  switch (kind) {
    case 'stripe': return <AccentStripe x={114} y={139} s={0.9} color={ink}/>;
    case 'skull': return <G transform={`translate(${x} ${y})`}><Path d="M-11 -2a11 11 0 0 1 22 0c0 5-3 7-4 8v5h-14v-5c-1-1-4-3-4-8Z" fill={ink}/><Ellipse cx="-4.5" cy="-1" rx="3.4" ry="3.8" fill={w.c[0]}/><Ellipse cx="4.5" cy="-1" rx="3.4" ry="3.8" fill={w.c[0]}/><Path d="M0 3l-1.6 3h3.2Z" fill={w.c[0]}/><Path d="M-4 8v3M0 8v3M4 8v3" stroke={w.c[0]} strokeWidth="1.1"/><Path d="M-16 18q16-6 32 0" stroke={ink} strokeWidth="2" fill="none" opacity={0.7}/></G>;
    case 'pumpkin': return <G transform={`translate(${x} ${y})`}><Ellipse cx="0" cy="2" rx="13" ry="10.5" fill={ink}/><Path d="M-5 -7q5 4 10 0M0 -8v-4" stroke="#3C5A1E" strokeWidth="2.2" strokeLinecap="round" fill="none"/><Path d="M-7 -1l3 -3 3 3Z M1 -1l3 -3 3 3Z" fill="#2A1606"/><Path d="M-8 4q8 7 16 0l-3 2-2-2-3 2-3-2-2 2Z" fill="#2A1606"/></G>;
    case 'heart': return <Path transform={`translate(${x} ${y - 8}) scale(2.2)`} d="M0 6-4.5 1.5a2.6 2.6 0 0 1 4.5-3 2.6 2.6 0 0 1 4.5 3Z" fill={ink}/>;
    case 'logo': return <G><Rect x="106" y="133" width="11" height="8" rx="1.2" fill={ink}/><Path d="M108.5 137h6" stroke={w.c[0]} strokeWidth="1.2"/></G>;
    case 'crest': return <G><Ellipse cx="112" cy="138" rx="4.6" ry="2.6" fill={ink}/><Path d="M108 138l-3 -1.4" stroke={ink} strokeWidth="1"/></G>;
    case 'stripes3': return <G stroke={ink} strokeWidth="1.6"><Path d="M70 128 L67 206M74 128 L71.5 207M78 128 L76 207"/><Path d="M130 128 L133 206M126 128 L128.5 207M122 128 L124 207"/></G>;
    default: return null;
  }
}

// ------------------------------------------------------------------ BODY (legs, shoes, clothes on torso)
function Shoe({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const [c0, c1] = w.c;
  const v = w.item.preview.variant;
  if (v === 'boot' || v === 'fluffy' || v === 'workboot') {
    const top = v === 'workboot' ? 312 : 294;
    const shaft = `M76 ${top} L100 ${top} L101.5 338 Q103 349 97 351 L71.5 351 Q67 348 70 337 Z`;
    return <G>
      <Cloth d={shaft} fill={c0} ctx={ctx}/>
      <Path d="M69.5 346 L103 346 Q103.5 353 98 354 L72 354 Q68 353 69.5 346 Z" fill={v === 'fluffy' ? shade(c0, -0.15) : shade(c0, -0.55)}/>
      {v === 'boot' && <Path d={`M75.5 ${top} L100.5 ${top} L100.6 ${top + 7} L75.6 ${top + 7} Z`} fill="#F1E6D2"/>}
      {v === 'workboot' && <Path d="M82 318h12M82 324h12M82 330h12" stroke="#3A2A18" strokeWidth="1.2"/>}
      {v === 'fluffy' && [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <Circle key={i} cx={i % 2 ? 101 : 75} cy={top + 4 + i * 6} r={4.2} fill={shade(c0, 0.18)} opacity={0.9}/>)}
      {v === 'fluffy' && [0, 1, 2, 3, 4].map(i => <Circle key={`t${i}`} cx={78 + i * 5.5} cy={top + 1} r={4} fill={shade(c0, 0.25)}/>)}
    </G>;
  }
  if (v === 'bunny') return <G>
    <Ellipse cx="80" cy="318" rx="3.6" ry="11" fill={c0} transform="rotate(-14 80 318)"/><Ellipse cx="94" cy="318" rx="3.6" ry="11" fill={c0} transform="rotate(14 94 318)"/>
    <Ellipse cx="80" cy="318" rx="1.6" ry="7.5" fill={c1} transform="rotate(-14 80 318)"/><Ellipse cx="94" cy="318" rx="1.6" ry="7.5" fill={c1} transform="rotate(14 94 318)"/>
    <Cloth d="M68 340 Q68 326 87 326 Q106 326 106 340 Q106 353 87 354 Q68 353 68 340 Z" fill={c0} ctx={ctx} edge={0.12}/>
    <Circle cx="82" cy="336" r="1.6" fill="#222"/><Circle cx="92" cy="336" r="1.6" fill="#222"/><Ellipse cx="87" cy="341" rx="2.2" ry="1.5" fill={c1}/>
  </G>;
  if (v === 'clog') return <G>
    <Path d="M71 334 Q74 324 86 324 Q98 324 100 334" stroke={shade(c0, -0.2)} strokeWidth="3" fill="none"/>
    <Cloth d="M69 342 Q69 328 86 328 Q103 328 103 342 L103 347 L69 347 Z" fill={c0} ctx={ctx}/>
    {[78, 86, 94, 82, 90].map((x, i) => <Circle key={i} cx={x} cy={i < 3 ? 334 : 340} r={1.6} fill={shade(c0, -0.35)}/>)}
    <Path d="M68 346 L104 346 Q104 352 99 353 L73 353 Q68 352 68 346 Z" fill={shade(c0, -0.12)}/>
  </G>;
  const chunky = v === 'chunky';
  const sole = chunky ? 'M66.5 342 L106 342 Q108 356 100 357 L73 357 Q65.5 356 66.5 342 Z' : 'M68 342 L105 342 Q106 352 99 353 L74 353 Q67 352 68 342 Z';
  const upper = chunky ? 'M68.5 341 Q68.5 322 80 321 L95 321 Q104.5 323 104.5 341 L104.5 345 L68.5 345 Z' : 'M69.5 341 Q69.5 323 80 322 L95 322 Q103.5 324 103.5 341 L103.5 345 L69.5 345 Z';
  return <G>
    <Cloth d={upper} fill={c0} ctx={ctx} edge={0.16}/>
    <Path d={sole} fill={chunky ? '#F2F2F4' : v === 'sneaker' && luminance(c0) < 0.3 ? '#F2F2F4' : shade(c1, 0.25)}/>
    {chunky && <Path d="M67 348h39" stroke={c1} strokeWidth="1.6"/>}
    <Path d="M81.5 329h11M82 333.5h11M82.5 338h10" stroke={luminance(c0) > 0.5 ? '#C9C9CF' : '#555'} strokeWidth="1.1" strokeLinecap="round"/>
    {w.item.preview.graphic === 'stripe' && <AccentStripe x={78} y={340} s={0.75} color={luminance(c0) > 0.5 ? '#C4C4CA' : '#FFF'}/>}
    {w.item.preview.graphic === 'stripes3' && <Path d="M73 338l4 -7M76.5 339l4 -7M80 340l4 -7" stroke={c1} strokeWidth="1.4"/>}
  </G>;
}

function Bottom({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const v = w.item.preview.variant;
  const fill = paint(ctx, 'bottom');
  const dark = shade(w.c[0], -0.22);
  if (v === 'skirt') return <G><Cloth d={SKIRT} fill={fill} ctx={ctx}/><Path d="M80 204 L74 280M92 205 L90 283M108 205 L110 283M120 204 L126 280" stroke={dark} strokeWidth="1" opacity={0.7}/></G>;
  if (v === 'shorts') return <G><Cloth d={SHORTS} fill={fill} ctx={ctx}/><Path d="M66 198 Q100 204 134 198 L134 206 Q100 212 66 206 Z" fill={dark}/></G>;
  const d = v === 'joggers' ? JOGGERS : PANTS_WIDE;
  return <G>
    <Cloth d={d} fill={fill} ctx={ctx}/>
    <Path d="M66 198 Q100 204 134 198 L134.3 207 Q100 213 65.7 207 Z" fill={dark}/>
    {v === 'joggers' && <Both><Path d="M73 312 L96 312 L96 322 L73.5 322 Z" fill={dark}/></Both>}
    {v === 'joggers' && w.item.preview.graphic === 'stripes3' && <Both><Path d="M66.5 208 L72.5 314M69 208 L75 314M71.5 208 L77.5 314" stroke={w.c[1]} strokeWidth="1.2"/></Both>}
    {v === 'joggers' && w.item.preview.graphic === 'stripe' && <AccentStripe x={88} y={226} s={0.7} color="#FFF"/>}
    {v === 'cargo' && <Both>
      <Path d="M63.7 236 L77.5 236 L78 272 Q71 274 64.6 272 Z" fill={shade(w.c[0], -0.05)} stroke="#000" strokeOpacity={0.2} strokeWidth="0.7"/>
      <Path d="M64.4 269 Q71 271.5 77.9 269 L78 272 Q71 274 64.6 272 Z" fill="#000" opacity={0.12}/>
      <Path d="M65.5 238 L66 268" stroke="#FFF" strokeOpacity={0.35} strokeWidth="1"/>
      <Path d="M63.5 234 L77.8 234 L77.9 242 Q71 244 63.6 242 Z" fill={shade(w.c[0], -0.1)} stroke="#000" strokeOpacity={0.18} strokeWidth="0.6"/>
      <Circle cx="70.7" cy="239.5" r="1" fill={shade(w.c[0], -0.35)}/>
      <Path d="M67 288 Q80 293 96 287M66 302 Q80 309 96.5 300M66 316 Q81 322 96.5 315" stroke="#000" strokeOpacity={0.14} strokeWidth="1.3" fill="none"/>
      <Path d="M70 296 Q83 300 95 295" stroke="#FFF" strokeOpacity={0.35} strokeWidth="1" fill="none"/>
    </Both>}
    {v === 'jeans' && <><Path d="M100 210 L100 226M88 210 Q90 220 82 222M112 210 Q110 220 118 222" stroke={shade(w.c[0], -0.35)} strokeWidth="1" fill="none"/><Both><Path d="M66 316 L97 316" stroke={shade(w.c[0], 0.2)} strokeWidth="2"/></Both></>}
    {v === 'workpant' && <Both><Path d="M65 250 L97.5 250 L97.5 288 L65.5 288 Z" fill={shade(w.c[0], -0.1)} stroke="#000" strokeOpacity={0.2} strokeWidth="0.7"/></Both>}
  </G>;
}

function Dress({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const v = w.item.preview.variant;
  const fill = paint(ctx, 'dress');
  const dark = shade(w.c[0], -0.3);
  const shapes: Record<string, string> = {
    gown: 'M74 121 Q87 129 100 123 Q113 129 126 121 L130 200 Q141 270 156 352 Q100 362 44 352 Q59 270 70 200 Z',
    tulle: 'M74 121 Q87 129 100 123 Q113 129 126 121 L129 196 Q150 266 170 352 Q100 368 30 352 Q50 266 71 196 Z',
    mini: 'M74 121 Q100 129 126 121 L130 196 L144 270 Q100 280 56 270 L70 196 Z',
    slip: 'M78 121 Q100 127 122 121 L128 200 L138 304 Q100 312 62 304 L72 200 Z',
  };
  const d = shapes[v] ?? shapes.gown;
  return <G>
    <Path d="M80 121 L84 110M120 121 L116 110" stroke={w.c[0]} strokeWidth="2.6" strokeLinecap="round"/>
    <Cloth d={d} fill={fill} ctx={ctx}/>
    {v === 'tulle' && <Path d="M50 290 Q100 300 150 290M40 324 Q100 336 160 324M62 250 Q100 258 138 250" stroke={w.c[1]} strokeWidth="2" fill="none" opacity={0.8}/>}
    {(v === 'gown' || v === 'slip') && <Path d="M86 210 Q84 280 76 348M100 212 L100 352M114 210 Q116 280 124 348" stroke={dark} strokeWidth="1.2" fill="none" opacity={0.45}/>}
    {v === 'mini' && <Path d="M70 196 Q100 204 130 196" stroke={w.c[1]} strokeWidth="2.4" fill="none"/>}
    {v === 'gown' && !w.item.preview.pattern && <Path d="M88 140 Q92 200 84 260M110 150 Q106 210 116 270" stroke="#FFF" strokeOpacity={0.18} strokeWidth="2" fill="none"/>}
  </G>;
}

function Top({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const v = w.item.preview.variant;
  const fill = paint(ctx, 'top');
  const dark = shade(w.c[0], -0.18);
  return <G>
    <Cloth d={v === 'tank' ? TANK : TEE} fill={fill} ctx={ctx}/>
    {v === 'tank' && <Path d="M80 116 Q100 134 120 116" stroke={w.c[1]} strokeWidth="2.2" fill="none"/>}
    {(v === 'tee' || v === 'longsleeve') && <Path d="M88.5 115.5 Q100 127 111.5 115.5" stroke={dark} strokeWidth="2.6" fill="none"/>}
    {v === 'polo' && <><Path d="M100 124 L100 140" stroke={dark} strokeWidth="1.4"/><Circle cx="100" cy="130" r="0.9" fill={w.c[2]}/><Circle cx="100" cy="136" r="0.9" fill={w.c[2]}/>
      <Path d="M86 113 L100 124 L93 132 Z M114 113 L100 124 L107 132 Z" fill={w.item.preview.pattern ? w.c[2] : w.c[0]} stroke="#000" strokeOpacity={0.25} strokeWidth="0.6"/></>}
    {v === 'shirt' && <><Path d="M100 123 L100 210" stroke="#000" strokeOpacity={0.3} strokeWidth="1"/>{[134, 150, 166, 182, 198].map(y => <Circle key={y} cx="101.5" cy={y} r="0.9" fill="#EEE"/>)}
      <Path d="M86 113 L100 123 L92 132 Z M114 113 L100 123 L108 132 Z" fill={fill} stroke="#000" strokeOpacity={0.3} strokeWidth="0.7"/><Rect x="106" y="140" width="11" height="12" rx="1" fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth="0.8"/></>}
    {w.item.preview.graphic && <Graphic w={w} kind={w.item.preview.graphic} ctx={ctx}/>}
  </G>;
}

function hasHood(v: string) { return v === 'hoodie' || v === 'zip'; }

function OuterBody({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const v = w.item.preview.variant;
  const fill = paint(ctx, 'outerwear');
  const base = w.c[0];
  const dark = shade(base, -0.2);
  if (v === 'cape') return <G>
    <Both><Cloth d="M62 121 L84 117 L80 318 Q66 324 48 318 Q53 220 62 121 Z" fill={fill} ctx={ctx}/><Path d="M84 118 L80 318" stroke={`url(#${ctx.p}gold)`} strokeWidth="2.6"/><Path d="M48 318 Q66 324 80 318" stroke={`url(#${ctx.p}gold)`} strokeWidth="2.4" fill="none"/></Both>
  </G>;
  const closed = v === 'hoodie' || v === 'bomber' || v === 'puffer';
  const body = v === 'puffer' ? PUFFER : OUT_BODY;
  const ribbed = v === 'bomber' || v === 'varsity';
  return <G>
    {closed ? <Cloth d={body} fill={fill} ctx={ctx}/> : <Both><Cloth d={v === 'fur' ? 'M64 118 C74 110 87 109 96.5 113 L98 262 Q78 268 58 262 L59 132 Z' : OUT_LEFT} fill={fill} ctx={ctx}/></Both>}
    {v === 'fur' && <Both>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => <Circle key={i} cx={96 - (i % 2) * 2} cy={118 + i * 11.5} r={4.6} fill={shade(base, 0.1)} opacity={0.95}/>)}{[0, 1, 2, 3, 4, 5].map(i => <Circle key={`h${i}`} cx={62 + i * 6.4} cy={262 + (i % 2)} r={4.4} fill={shade(base, 0.06)}/>)}</Both>}
    {hasHood(v) && <><Both><Path d="M77 116 Q79 108 92 106 Q90 118 99 131 L96 134 Q80 128 77 116 Z" fill={shade(base, 0.05)} stroke="#000" strokeOpacity={0.3} strokeWidth="0.7"/></Both></>}
    {v === 'hoodie' && <><Path d="M100 131 L100 196" stroke={luminance(base) < 0.3 ? '#5A5A60' : shade(base, -0.35)} strokeWidth="1.3"/><Path d="M93 130 L91.5 156M107 130 L108.5 156" stroke={w.c[1]} strokeWidth="1.4" strokeLinecap="round"/>
      <Path d="M70 172 Q80 168 86 172 L86 194M130 172 Q120 168 114 172 L114 194" stroke="#000" strokeOpacity={0.35} strokeWidth="1" fill="none"/></>}
    {v === 'zip' && <><Path d="M93 128 L92 154M107 128 L108 154" stroke={w.c[1]} strokeWidth="1.4" strokeLinecap="round"/><Both><Path d="M96.6 114 L97.5 205" stroke="#8E8E93" strokeWidth="1.2"/></Both></>}
    {(v === 'jacket' || v === 'varsity' || v === 'vest') && <Both><Path d="M82 113 L95 116 L93 140 L80 125 Z" fill={v === 'varsity' ? w.c[1] : dark} stroke="#000" strokeOpacity={0.3} strokeWidth="0.7"/></Both>}
    {v === 'jacket' && <Both><Rect x="72" y="140" width="13" height="12" rx="1.5" fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth="0.9"/><Path d="M72 144h13" stroke="#000" strokeOpacity={0.3} strokeWidth="0.8"/></Both>}
    {v === 'puffer' && <Path d="M79 105 Q100 99 121 105 L123 124 Q100 131 77 124 Z" fill={shade(base, -0.05)} stroke="#000" strokeOpacity={0.25} strokeWidth="0.7"/>}
    {v === 'puffer' && <Path d="M100 124 L100 210" stroke={w.c[1]} strokeWidth="1.6"/>}
    {ribbed && <><Path d={closed ? 'M61 197 Q100 203 139 197 L139 205 Q100 211 61 205 Z' : 'M61 198 Q80 202 97.5 199 L97.5 206 Q80 209 61 205 Z'} fill={w.c[v === 'varsity' ? 1 : 0]} opacity={0.95}/>{!closed && <G transform={MIRROR}><Path d="M61 198 Q80 202 97.5 199 L97.5 206 Q80 209 61 205 Z" fill={w.c[1]}/></G>}
      <Path d={closed ? 'M61 200.5 Q100 206.5 139 200.5' : 'M61 201 Q80 205 97.5 202'} stroke={w.c[2]} strokeWidth="1.2" fill="none"/>{closed && <Path d="M84 114 Q100 124 116 114 L116 119 Q100 129 84 119 Z" fill={shade(base, -0.25)}/>}</>}
    {w.item.preview.graphic === 'stripe' && <AccentStripe x={115} y={139} s={0.95} color={w.c[1]}/>}
    {w.item.preview.graphic === 'logo' && <Rect x="105" y="141" width="10" height="7" rx="1" fill={w.c[1]}/>}
  </G>;
}

function HoodBack({ ctx, w }: { ctx: Ctx; w: Worn }) {
  if (!hasHood(w.item.preview.variant)) return null;
  return <Path d="M78 120 Q76 98 100 96 Q124 98 122 120 Z" fill={shade(w.c[0], -0.35)}/>;
}

function BagArt({ w, ctx }: { w: Worn; ctx: Ctx }) {
  const [c0, c1] = w.c;
  const v = w.item.preview.variant;
  const metal = <Rect x="-3.5" y="-4" width="7" height="4" rx="1" fill={`url(#${ctx.p}gold)`}/>;
  if (v === 'backpack') return <G>
    <Path d="M-12 -26 Q0 -36 12 -26" stroke={shade(c0, -0.35)} strokeWidth="3.4" fill="none"/>
    <Cloth d="M-22 -14 Q-22 -27 -9 -27 L9 -27 Q22 -27 22 -14 L22 22 Q22 28 16 28 L-16 28 Q-22 28 -22 22 Z" fill={c0} ctx={ctx}/>
    <Cloth d="M-15 2 L15 2 L15 20 Q15 24 11 24 L-11 24 Q-15 24 -15 20 Z" fill={shade(c0, -0.12)} ctx={ctx} v={false}/>
    <Path d="M-15 -3 L15 -3" stroke={c1} strokeWidth="1.6"/><Path d="M-4 -10 L4 -10 L0 -4 Z" fill="#E7E7EA" opacity={0.9}/>
  </G>;
  if (v === 'shoulder') return <G>
    <Path d="M-20 -8 Q-20 -36 0 -36 Q20 -36 20 -8" stroke={c1} strokeWidth="2.6" fill="none"/>
    <Cloth d="M-24 -6 Q-24 -18 -12 -18 L12 -18 Q24 -18 24 -6 L22 16 Q0 22 -22 16 Z" fill={c0} ctx={ctx}/>
    <Path d="M-24 -6 Q0 6 24 -6 L23 -2 Q0 12 -23 -2 Z" fill={shade(c0, -0.15)}/><G transform="translate(0 4)">{metal}</G>
  </G>;
  if (v === 'bowling') return <G>
    <Path d="M-12 -14 Q-12 -30 0 -30 Q12 -30 12 -14" stroke={c1} strokeWidth="3" fill="none"/>
    <Cloth d="M-27 16 Q-29 -14 0 -17 Q29 -14 27 16 Q0 21 -27 16 Z" fill={c0} ctx={ctx}/>
    <Path d="M-22 -6 Q0 -14 22 -6" stroke={c1} strokeWidth="1.4" fill="none"/><Path d="M-27 13 Q0 18 27 13" stroke={c1} strokeWidth="2.4" fill="none"/>
    <G transform="translate(14 6)">{metal}</G><Path d="M16 6 L18 14" stroke={c1} strokeWidth="1"/>
  </G>;
  if (v === 'duffel') return <G>
    <Path d="M-12 -12 Q-12 -24 0 -24 Q12 -24 12 -12" stroke={shade(c0, 0.2)} strokeWidth="3" fill="none"/>
    <Cloth d="M-26 -12 L26 -12 Q32 -12 32 0 Q32 14 26 14 L-26 14 Q-32 14 -32 0 Q-32 -12 -26 -12 Z" fill={c0} ctx={ctx}/>
    <Path d="M-32 0 L32 0" stroke={c1} strokeWidth="3"/><Path d="M-10 14 L-4 -12M-4 14 L2 -12M2 14 L8 -12" stroke="#FFF" strokeWidth="1.5" opacity={0.9}/>
  </G>;
  // handbag
  return <G>
    <Path d="M-12 -10 Q-12 -27 0 -27 Q12 -27 12 -10" stroke={shade(c0, -0.3)} strokeWidth="3" fill="none"/>
    <Cloth d="M-22 -10 L22 -10 L26 18 Q0 23 -26 18 Z" fill={c0} ctx={ctx}/>
    <Path d="M-22 -10 L22 -10 L20 0 Q0 6 -20 0 Z" fill={shade(c0, -0.12)}/><G transform="translate(0 3)">{metal}</G>
    {[-16, -8, 8, 16].map(x => <Circle key={x} cx={x} cy={16} r="1" fill={c1}/>)}
  </G>;
}

function MicArt({ w }: { w: Worn }) {
  const [c0, c1] = w.c;
  return <G>
    <Path d="M-3.2 6 L3.2 6 L1.8 34 L-1.8 34 Z" fill={c0}/><Path d="M-1 6 L-1 34" stroke="#FFF" strokeOpacity={0.35} strokeWidth="0.8"/>
    <Rect x="-4.6" y="3" width="9.2" height="4" rx="1" fill={shade(c0, -0.3)}/>
    <Circle cx="0" cy="-4" r="8" fill={c1}/><Circle cx="-2.5" cy="-6.5" r="3" fill="#FFF" opacity={0.45}/>
    <Path d="M-7 -4h14M-6 -8h12M-6 0h12M0 -11v14M-4 -10.5v13M4 -10.5v13" stroke={shade(c1, -0.35)} strokeWidth="0.6"/>
  </G>;
}

export function BodyParts({ ctx }: { ctx: Ctx }) {
  const { look } = ctx;
  const { items: it } = look;
  const skin = look.mannequin ? MANNEQUIN : look.skin;
  const dress = it.dress;
  const outer = it.outerwear;
  const bag = it.bag;
  const sockW = it.socks;
  return <G>
    <Ellipse cx="100" cy="353" rx="60" ry="8" fill="#000" opacity={0.5}/>
    <Ellipse cx="100" cy="352" rx="38" ry="4.5" fill="#000" opacity={0.45}/>
    {outer?.item.preview.variant === 'cape' && <G><Cloth d="M58 121 L142 121 Q152 230 160 334 Q100 346 40 334 Q48 230 58 121 Z" fill={paint(ctx, 'outerwear')} ctx={ctx}/><Path d="M40 334 Q100 346 160 334" stroke={`url(#${ctx.p}gold)`} strokeWidth="3" fill="none"/></G>}
    {bag?.item.preview.variant === 'backpack' && <Path d="M60 128 L140 128 L142 204 L58 204 Z" fill={shade(bag.c[0], -0.3)}/>}
    <Both><Cloth d={LEG} fill={skin} ctx={ctx} v={false} edge={0.1}/></Both>
    {sockW && <Both><Cloth d={sockW.item.preview.variant === 'long' ? 'M77 292 L97.6 292 L95.6 340 L80.4 340 Z' : 'M79 316 L96.6 316 L95.6 340 L80.4 340 Z'} fill={paint(ctx, 'socks')} ctx={ctx} v={false}/>
      <Path d={sockW.item.preview.variant === 'long' ? 'M77 295 L97.5 295' : 'M79 319 L96.5 319'} stroke={shade(sockW.c[0], -0.2)} strokeWidth="2"/>
      {sockW.item.preview.graphic === 'stripes3' && <Path d={sockW.item.preview.variant === 'long' ? 'M77.3 300 L97.4 300M77.4 304 L97.3 304' : 'M79 323 L96.4 323'} stroke={sockW.c[1]} strokeWidth="1.6"/>}
      {sockW.item.preview.graphic === 'stripe' && <AccentStripe x={86} y={330} s={0.55} color={sockW.c[1]}/>}</Both>}
    {it.shoes && <Both><Shoe ctx={ctx} w={it.shoes}/></Both>}
    {!dress && it.bottom && <Bottom ctx={ctx} w={it.bottom}/>}
    {outer && <HoodBack ctx={ctx} w={outer}/>}
    <Cloth d={TORSO_SKIN} fill={skin} ctx={ctx} v={false} edge={0.08}/>
    <Cloth d={NECK} fill={skin} ctx={ctx} v={false} edge={0}/>
    <Ellipse cx="100" cy="100" rx="11" ry="5" fill="#000" opacity={0.2}/>
    {dress && <Dress ctx={ctx} w={dress}/>}
    {!dress && it.top && <Top ctx={ctx} w={it.top}/>}
    {outer && <OuterBody ctx={ctx} w={outer}/>}
    {bag?.item.preview.variant === 'backpack' && <Both><Path d="M82 116 Q76 150 79 198" stroke={shade(bag.c[0], -0.25)} strokeWidth="5.5" fill="none" strokeLinecap="round"/><Path d="M78 168 L84 168" stroke={`url(#${ctx.p}gold)`} strokeWidth="2.4"/></Both>}
    {(bag?.item.preview.variant === 'shoulder' || bag?.item.preview.variant === 'duffel') && <Path d="M80 116 Q104 150 126 196" stroke={bag.item.preview.variant === 'duffel' ? shade(bag.c[0], 0.15) : bag.c[1]} strokeWidth="2.6" fill="none"/>}
  </G>;
}

/** Sleeve source: outerwear with sleeves, else the top (none under a dress). */
function sleeveOf(look: Look): { fill: string; layer: WardrobeCategory; len: 'long' | 'short' | 'none' | 'puff'; cuff: string; w: Worn } | null {
  const outer = look.items.outerwear;
  const ov = outer?.item.preview.variant;
  if (outer && ov !== 'vest' && ov !== 'cape') {
    const sleeveColor = ov === 'varsity' ? outer.c[1] : null;
    return { fill: sleeveColor ?? '', layer: 'outerwear', len: ov === 'puffer' || ov === 'fur' ? 'puff' : 'long', cuff: ov === 'varsity' ? outer.c[0] : shade(outer.c[0], -0.2), w: outer };
  }
  if (look.items.dress) return null;
  const top = look.items.top;
  if (!top) return null;
  const tv = top.item.preview.variant;
  return { fill: '', layer: 'top', len: tv === 'tank' ? 'none' : tv === 'tee' || tv === 'polo' ? 'short' : 'long', cuff: shade(top.c[0], -0.2), w: top };
}

/** One arm in "left" (viewer-left) coordinates; the right arm is rendered mirrored by the caller. */
export function ArmParts({ ctx, side, pose = 'rest' }: { ctx: Ctx; side: 'L' | 'R'; pose?: HandPose }) {
  const { look } = ctx;
  const skin = look.mannequin ? MANNEQUIN : look.skin;
  const s = sleeveOf(look);
  const fill = s ? (s.fill || paint(ctx, s.layer)) : '';
  const acc = look.items.accessory;
  const bag = look.items.bag;
  const holdsMic = side === 'L' && acc?.item.preview.variant === 'mic';
  const holdsBag = side === 'R' && (bag?.item.preview.variant === 'handbag' || bag?.item.preview.variant === 'bowling');
  return <G>
    <Cloth d={ARM_SKIN} fill={skin} ctx={ctx} v={false} edge={0.1}/>
    {s && s.len !== 'none' && <Cloth d={s.len === 'short' ? SLEEVE_SHORT : s.len === 'puff' ? SLEEVE_PUFF : SLEEVE_LONG} fill={fill} ctx={ctx}/>}
    {s?.len === 'long' && <Path d="M51 195 L67.4 195 L66.5 202 L50.5 202 Z" fill={s.cuff}/>}
    {s?.len === 'puff' && s.w.item.preview.pattern === 'quilt' && <Path d="M56 140h24M54 154h23M52 168h22M51 182h20M50 194h19" stroke={shade(s.w.c[0], -0.2)} strokeWidth="1.1"/>}
    {s?.len === 'short' && <Path d="M53.5 160.5 Q65 165.5 76.5 161" stroke={s.cuff} strokeWidth="2.4" fill="none"/>}
    {holdsMic && acc && <G transform="translate(58.5 199) scale(0.82)"><MicArt w={acc}/></G>}
    {holdsBag && bag && <G transform="translate(58 240) scale(0.52)"><BagArt w={bag} ctx={ctx}/></G>}
    {pose === 'peace' && <Path d="M55.5 218 L52.5 233M61 218 L63.5 233" stroke={skin} strokeWidth="4.4" strokeLinecap="round"/>}
    <Ellipse cx="58.5" cy="212.5" rx="7" ry="9.5" fill={skin}/>
    <Ellipse cx="58.5" cy="212.5" rx="7" ry="9.5" fill={`url(#${ctx.p}cyl)`}/>
    <Ellipse cx="64.2" cy="208.5" rx="2.6" ry="5" fill={shade(skin, -0.06)} transform="rotate(-18 64.2 208.5)"/>
    {pose !== 'peace' && <Path d="M53.5 214 Q55 220 58 221M57 214 Q58.5 220 61.5 220" stroke={shade(skin, -0.3)} strokeWidth="0.7" fill="none" opacity={0.7}/>}
  </G>;
}

/** [cx, cy, r, layer] — 0 = back (darker), 1 = mid, 2 = front fringe. */
const CURLS: [number, number, number, number][] = [
  [71, 61, 6.5, 0], [129, 61, 6.5, 0], [69, 50, 8, 0], [131, 49, 8, 0], [76, 38, 9, 0], [124, 37, 9, 0], [88, 28, 10, 0], [100, 25.5, 10, 0], [112, 28, 10, 0],
  [80, 45, 8, 1], [92, 37, 8.5, 1], [105, 35.5, 8.5, 1], [117, 40, 8, 1], [126, 50, 7, 1], [74, 52, 6.5, 1], [86, 31, 7, 1], [99, 30, 7.5, 1], [112, 32, 7, 1],
  [79, 55.5, 5.8, 2], [88.5, 50.5, 6.4, 2], [98, 48, 6.4, 2], [107.5, 48.5, 6.4, 2], [116.5, 51.5, 6, 2], [123.5, 57, 5, 2], [74.5, 61, 4.6, 2],
];

function Curl({ p, cx, cy, r, layer, dark }: { p: string; cx: number; cy: number; r: number; layer: number; dark: string }) {
  return <G>
    <Circle cx={cx} cy={cy} r={r} fill={`url(#${p}hair)`}/>
    {layer === 0 && <Circle cx={cx} cy={cy} r={r} fill="#000" opacity={0.18}/>}
    <Path d={`M${cx - r * 0.6} ${cy + r * 0.15} a${r * 0.52} ${r * 0.52} 0 1 1 ${r * 0.62} ${r * 0.5}`} stroke={dark} strokeOpacity={0.6} strokeWidth={layer === 2 ? 0.9 : 1.1} fill="none"/>
    <Path d={`M${cx - r * 0.55} ${cy - r * 0.45} q${r * 0.4} ${-r * 0.4} ${r * 0.9} ${-r * 0.15}`} stroke="#FFF3CF" strokeOpacity={layer === 0 ? 0.25 : 0.55} strokeWidth="1" fill="none" strokeLinecap="round"/>
  </G>;
}

/** Afro cloud: [cx, cy, r] around the crown. */
const AFRO: [number, number, number][] = [
  [62, 74, 9], [138, 74, 9], [58, 60, 11], [142, 60, 11], [60, 44, 12], [140, 44, 12], [68, 29, 13], [132, 29, 13], [82, 19, 14], [100, 16, 14], [118, 19, 14],
];

function Strands({ d, dark }: { d: string; dark: string }) {
  return <Path d={d} stroke={dark} strokeOpacity={0.45} strokeWidth="1" fill="none" strokeLinecap="round"/>;
}

/**
 * Back part of hairstyles that fall to / past the shoulders (Golvend, Lang). Drawn BEFORE BodyParts, so
 * neck, shoulders, hoodie/hood, top and arms cover it and the hair reads as hanging behind the back.
 * Afro (lowest curl y≈83), Knot (bun) and the short styles end above the shoulder line (y≈109), so they
 * stay in HairBack (behind the face, inside the head layer). Only the front strands of 'long'
 * (HairFront) are drawn over the face/shoulders to frame the face.
 */
export function hasHairBehind(look: Look): boolean {
  return !look.mannequin && (look.hairStyle === 'long' || look.hairStyle === 'wavy');
}

export function HairBehindParts({ ctx }: { ctx: Ctx }) {
  const { look, p } = ctx;
  if (look.mannequin) return null;
  const dark = shade(look.hair, -0.45);
  const fill = `url(#${p}hair)`;
  switch (look.hairStyle ?? 'curly') {
    case 'wavy': {
      const d = 'M66 64 Q62 26 100 23 Q138 26 134 64 Q138 84 134 100 Q138 108 131 114 Q126 104 128 94 L72 94 Q74 104 69 114 Q62 108 66 100 Q62 84 66 64 Z';
      return <G><Path d={d} fill={dark}/><Path d={d} fill={fill} opacity={0.55}/></G>;
    }
    case 'long': {
      const d = 'M64 66 Q60 24 100 21 Q140 24 136 66 L140 120 Q142 140 134 150 Q124 146 122 132 L120 96 L80 96 L78 132 Q76 146 66 150 Q58 140 60 120 Z';
      return <G>
        <Path d={d} fill={dark}/>
        <Path d={d} fill={fill} opacity={0.5}/>
        <Strands d="M66 90 Q64 116 66 144M134 90 Q136 116 134 144M70 100 Q70 122 72 138M130 100 Q130 122 128 138" dark={dark}/>
      </G>;
    }
    default: return null;
  }
}

/** Hair drawn behind the ears/face (inside the head layer, over the body). */
function HairBack({ ctx, dark }: { ctx: Ctx; dark: string }) {
  const { look, p } = ctx;
  const fill = `url(#${p}hair)`;
  switch (look.hairStyle ?? 'curly') {
    case 'short': return <Path d="M67 70 Q62 30 100 25 Q138 30 133 70 Q130 54 100 47 Q70 54 67 70 Z" fill={dark}/>;
    case 'buzz': return null;
    // 'wavy' and 'long' reach the shoulders: their back part is drawn behind the body by HairBehindParts.
    case 'wavy': case 'long': return null;
    case 'afro': return <G>{AFRO.map(([cx, cy, r], i) => <Curl key={i} p={p} cx={cx} cy={cy} r={r} layer={0} dark={dark}/>)}<Path d="M58 80 Q52 30 100 14 Q148 30 142 80 Q130 50 100 44 Q70 50 58 80 Z" fill={dark}/></G>;
    case 'bun': return <G>
      <Circle cx="100" cy="21" r="14" fill={dark}/><Circle cx="100" cy="21" r="14" fill={fill} opacity={0.7}/>
      <Path d="M89 16 Q100 9 111 16M88 24 Q100 32 112 24" stroke={dark} strokeOpacity={0.5} strokeWidth="1" fill="none"/>
      <Path d="M67 70 Q62 30 100 27 Q138 30 133 70 Q130 54 100 47 Q70 54 67 70 Z" fill={dark}/>
    </G>;
    default: return <Path d="M66 72 Q60 28 100 22 Q140 28 134 72 Q131 56 126 50 Q100 42 74 50 Q69 56 66 72 Z" fill={dark}/>;
  }
}

/** Hair drawn over the forehead (after the face). */
function HairFront({ ctx, dark }: { ctx: Ctx; dark: string }) {
  const { look, p } = ctx;
  const fill = `url(#${p}hair)`;
  switch (look.hairStyle ?? 'curly') {
    case 'short': return <G>
      <Path d="M68 64 Q66 30 100 28 Q134 30 132 64 Q129 50 121 45 Q112 50 102 46 Q92 51 82 47 Q73 51 68 64 Z" fill={fill}/>
      <Strands d="M80 34 Q86 40 84 47M94 30 Q99 38 97 46M108 31 Q112 38 111 46M120 36 Q124 42 122 46" dark={dark}/>
    </G>;
    case 'buzz': return <G>
      <Path d="M70.5 63 Q70 35 100 34 Q130 35 129.5 63 Q127 50 118 46 Q100 42 82 46 Q73 50 70.5 63 Z" fill={dark} opacity={0.82}/>
      <Path d="M70.5 63 Q70 35 100 34 Q130 35 129.5 63 Q127 50 118 46 Q100 42 82 46 Q73 50 70.5 63 Z" fill={fill} opacity={0.35}/>
    </G>;
    case 'wavy': return <G>
      <Path d="M67 66 Q64 28 100 26 Q136 28 133 66 Q130 52 122 46 Q114 54 104 50 Q96 58 84 54 Q76 54 72 62 Q70 64 67 66 Z" fill={fill}/>
      <Strands d="M76 40 Q86 46 84 53M92 32 Q102 42 100 49M110 32 Q118 40 116 47M124 42 Q128 47 128.5 52" dark={dark}/>
    </G>;
    case 'long': {
      // One opaque paint (shared user-space gradient) for fringe and locks, so there is no colour step where a lock
      // disappears under the fringe. Lock tops (y≈40-50) lie fully inside the fringe on both sides (also mirrored),
      // and the fringe strands end inside the fringe instead of poking out over the lock/forehead.
      const long = `url(#${p}hairY)`;
      return <G>
        {/* Front strands: from the temples down past the cheeks, ending on the collarbone in front of the clothes. */}
        <Both>
          <Path d="M68 50 Q63 78 66.5 98 Q70 114 82 123 Q86 122 84.5 118.5 Q77 108 76.5 94 Q76 70 80 40 Z" fill={long}/>
          <Strands d="M72 62 Q69 88 72 104 Q75 114 81 120" dark={dark}/>
        </Both>
        <Path d="M66 70 Q62 28 100 25 Q138 28 134 70 Q132 56 126 48 Q116 44 104 46 Q96 40 86 44 Q74 48 70 60 Z" fill={long}/>
        <Path d="M100 26 Q98 36 104 45" stroke={dark} strokeOpacity={0.6} strokeWidth="1.2" fill="none"/>
        <Strands d="M84 32 Q79 39 77.5 46M116 32 Q121 39 122.5 45" dark={dark}/>
      </G>;
    }
    case 'afro': return <G>
      {[[76, 44, 9], [90, 38, 10], [104, 37, 10], [118, 41, 9], [127, 52, 7], [72, 54, 7], [84, 47, 7], [97, 45, 7.5], [111, 46, 7]].map(([cx, cy, r], i) => <Curl key={i} p={p} cx={cx} cy={cy} r={r} layer={i < 5 ? 1 : 2} dark={dark}/>)}
    </G>;
    case 'bun': return <G>
      <Path d="M68.5 64 Q66 31 100 29 Q134 31 131.5 64 Q128 48 114 45 Q100 44 100 44 Q86 44 76 47 Q70 52 68.5 64 Z" fill={fill}/>
      <Strands d="M100 30 Q88 36 80 48M100 30 Q112 36 120 48M100 30 Q96 38 92 45M100 30 Q104 38 108 45" dark={dark}/>
    </G>;
    default: return <G>{CURLS.map(([cx, cy, r, layer], i) => <Curl key={i} p={p} cx={cx} cy={cy} r={r} layer={layer} dark={dark}/>)}</G>;
  }
}

/** Static, cropped head (used by the hair style cards). */
export const HeadPreviewArt = React.memo(function HeadPreviewArt({ outfit, width, height }: { outfit: Outfit; width: number; height: number }) {
  const look = { ...lookFromOutfit({ ...outfit, hat: null, glasses: null, accessory: null }), items: {} };
  return <LayerSvg look={look} width={width} height={height} viewBox={fitViewBox([52, 6, 96, 112], width / height)}>
    {ctx => <G><HairBehindParts ctx={ctx}/><Path d={NECK} fill={look.skin}/><HeadParts ctx={ctx}/></G>}
  </LayerSvg>;
});

/** Static full figure (look cards, map markers). */
export const FigureArt = React.memo(function FigureArt({ outfit, width, height, crop }: { outfit: Outfit; width: number; height: number; crop?: [number, number, number, number] }) {
  const look = lookFromOutfit(outfit);
  return <LayerSvg look={look} width={width} height={height} viewBox={fitViewBox(crop ?? [20, 0, 160, 400], width / height)}>
    {ctx => <G>
      <HairBehindParts ctx={ctx}/>
      <BodyParts ctx={ctx}/>
      <ArmParts ctx={ctx} side="L"/>
      <G transform={MIRROR}><ArmParts ctx={ctx} side="R"/></G>
      <HeadParts ctx={ctx} expression="smile"/>
      <OverlayParts ctx={ctx}/>
    </G>}
  </LayerSvg>;
});

export function HeadParts({ ctx, expression = 'neutral', gaze = 'front' }: { ctx: Ctx; expression?: Expression; gaze?: Gaze }) {
  const { look, p } = ctx;
  const skin = look.mannequin ? MANNEQUIN : look.skin;
  const hairDark = shade(look.hair, -0.45);
  const hat = look.items.hat;
  const glasses = look.items.glasses;
  const acc = look.items.accessory;
  const smile = expression === 'smile';
  const dx = gaze === 'side' ? -1.4 : 0;
  const dy = gaze === 'down' ? 1.4 : 0;
  const FACE = 'M70 64 Q70 36 100 35 Q130 36 130 64 Q131 88 118 100 Q109 108 100 108 Q91 108 82 100 Q69 88 70 64 Z';
  return <G>
    {!look.mannequin && <HairBack ctx={ctx} dark={hairDark}/>}
    <Both><Ellipse cx="70" cy="75" rx="5.5" ry="8.5" fill={skin}/><Path d="M69 70 Q66.5 75 69.5 80" stroke={shade(skin, -0.3)} strokeWidth="1.2" fill="none"/></Both>
    <Path d={FACE} fill={skin}/>
    <Path d={FACE} fill={`url(#${p}face)`}/>
    {!look.mannequin && <>
      {(look.hairStyle ?? 'curly') !== 'buzz' && <Both><Path d="M70 60 Q70 74 72.5 79 L76 63 Z" fill={hairDark}/></Both>}
      <Ellipse cx="81" cy="89" rx="5.5" ry="2.6" fill="#E25F5F" opacity={smile ? 0.3 : 0.16}/><Ellipse cx="119" cy="89" rx="5.5" ry="2.6" fill="#E25F5F" opacity={smile ? 0.3 : 0.16}/>
      <Both><Path d={smile ? 'M79 61 Q87 55.5 95 59.5' : 'M79 63 Q87 58 95 61.5'} stroke={hairDark} strokeWidth="3.2" strokeLinecap="round" fill="none"/></Both>
      <Both>
        <Ellipse cx="88" cy={smile ? 73.5 : 73} rx="6.4" ry={smile ? 3.9 : 4.9} fill="#FFF"/>
        <Circle cx={88 + dx} cy={73 + dy} r="3.7" fill="#6B4226"/><Circle cx={88 + dx} cy={73 + dy} r="1.9" fill="#1A1110"/><Circle cx={89.3 + dx} cy={71.8 + dy} r="1" fill="#FFF"/>
        <Path d={smile ? 'M81.5 72 Q88 68 94.5 72' : 'M81.5 71 Q88 66.5 94.5 71'} stroke="#3B2416" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        {smile && <Path d="M82.5 76.5 Q88 78.6 93.5 76.5" stroke={shade(skin, -0.25)} strokeWidth="1" fill="none"/>}
      </Both>
      <Path d="M99 78 Q96.5 86 99.5 88.5 Q102 89.5 104 87.5" stroke={shade(skin, -0.3)} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      {smile ? <><Path d="M89.5 94 Q100 107 110.5 94 Q100 98 89.5 94 Z" fill="#5E1E22"/><Path d="M91.5 95 Q100 98.6 108.5 95 L107.6 97.6 Q100 100.6 92.4 97.6 Z" fill="#FFF"/></>
        : <><Path d="M92 96 Q100 99.5 108 96" stroke="#8C4A44" strokeWidth="2.2" fill="none" strokeLinecap="round"/><Path d="M95 100.5 Q100 102 105 100.5" stroke="#FFF" strokeOpacity={0.3} strokeWidth="1.2" fill="none"/></>}
      <HairFront ctx={ctx} dark={hairDark}/>
    </>}
    {glasses && <Glasses ctx={ctx} w={glasses}/>}
    {acc?.item.preview.variant === 'headset' && <G><Path d="M68 70 Q66 26 100 25 Q134 26 132 70" stroke={acc.c[0]} strokeWidth="4" fill="none"/><Both><Ellipse cx="68" cy="75" rx="6.5" ry="10" fill={acc.c[0]}/><Ellipse cx="66.5" cy="73" rx="2.5" ry="5" fill={acc.c[1]} opacity={0.6}/></Both><Path d="M66 82 Q70 100 90 99" stroke={acc.c[0]} strokeWidth="2" fill="none"/><Circle cx="91" cy="99" r="3.2" fill={acc.c[0]}/></G>}
    {hat && <Hat ctx={ctx} w={hat}/>}
  </G>;
}

function Glasses({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const [c0, c1] = w.c;
  const v = w.item.preview.variant;
  if (v === 'round') return <G><Both><Circle cx="88" cy="73.5" r="8.4" fill="#FFF" fillOpacity={0.08} stroke={c0} strokeWidth="2"/><Path d="M79.6 72 L70.5 70" stroke={c0} strokeWidth="1.8"/></Both><Path d="M96.4 72 Q100 69.5 103.6 72" stroke={c0} strokeWidth="1.8" fill="none"/></G>;
  if (v === 'aviator') return <G><Both><Path d="M78 67 Q88 64 97 67 Q97.5 81 88 81 Q78.5 80 78 67 Z" fill={c1} fillOpacity={0.75} stroke={c0} strokeWidth="1.6"/><Path d="M81 69 Q85 67.5 89 68.5" stroke="#FFF" strokeOpacity={0.5} strokeWidth="1"/><Path d="M78 68 L70.5 69" stroke={c0} strokeWidth="1.4"/></Both><Path d="M97 67 Q100 65.5 103 67" stroke={c0} strokeWidth="1.5" fill="none"/></G>;
  if (v === 'cateye') return <G><Both><Path d="M77 68.5 Q88 63.5 97 67.5 Q96.5 79 87 79 Q79 78 77 68.5 Z" fill="#FFF" fillOpacity={0.12} stroke={c0} strokeWidth="2.2"/><Path d="M77.5 68.5 L72 63.5" stroke={c0} strokeWidth="2.6" strokeLinecap="round"/></Both><Path d="M97 68 Q100 66.5 103 68" stroke={c0} strokeWidth="1.8" fill="none"/></G>;
  return <G><Both><Path d="M77 66.5 L97.5 66.5 Q98.5 79.5 88 80.5 Q77.5 79.5 77 66.5 Z" fill={`url(#${ctx.p}lens)`} stroke={c0} strokeWidth="1.6"/><Path d="M80.5 69 L85 69" stroke="#FFF" strokeOpacity={0.55} strokeWidth="1.2"/><Path d="M77 67.5 L70.5 69" stroke={c0} strokeWidth="1.8"/></Both><Path d="M97.5 67.5 L102.5 67.5" stroke={c0} strokeWidth="2"/></G>;
}

function Hat({ ctx, w }: { ctx: Ctx; w: Worn }) {
  const [c0, c1] = w.c;
  const v = w.item.preview.variant;
  if (v === 'beanie') return <G><Cloth d="M66 60 Q64 16 100 14 Q136 16 134 60 Z" fill={c0} ctx={ctx}/><Path d="M78 22 L76 52M89 16 L88 52M100 14 L100 52M111 16 L112 52M122 22 L124 52" stroke={shade(c0, -0.3)} strokeWidth="1" opacity={0.6}/><Cloth d="M63 51 Q100 43 137 51 L137 64 Q100 56 63 64 Z" fill={shade(c0, -0.08)} ctx={ctx} v={false}/></G>;
  if (v === 'cap') return <G><Cloth d="M68 56 Q67 21 100 20 Q133 21 132 56 Q100 48 68 56 Z" fill={c0} ctx={ctx}/><Path d="M100 21 L100 50M84 24 Q90 38 88 52M116 24 Q110 38 112 52" stroke="#000" strokeOpacity={0.15} strokeWidth="0.9" fill="none"/><Circle cx="100" cy="21" r="2.4" fill={shade(c0, -0.2)}/>
    <Cloth d="M65 56 Q100 45 135 56 Q133 67 100 65 Q67 67 65 56 Z" fill={c1} ctx={ctx} v={false}/>{w.item.preview.graphic === 'stripe' && <AccentStripe x={100} y={40} s={1.3} color={c1}/>}</G>;
  if (v === 'bucket') return <G><Cloth d="M71 52 Q71 20 100 19 Q129 20 129 52 Z" fill={c0} ctx={ctx}/><Cloth d="M57 57 Q100 43 143 57 L150 70 Q100 57 50 70 Z" fill={shade(c0, -0.05)} ctx={ctx} v={false}/><Path d="M60 62 Q100 50 140 62" stroke="#FFF" strokeOpacity={0.15} strokeWidth="0.9" fill="none"/></G>;
  return <G><Cloth d="M72 51 Q69 19 88 21 Q100 28 112 21 Q131 19 128 51 Z" fill={c0} ctx={ctx}/><Path d="M71.5 43 Q100 37 128.5 43 L128.6 51 Q100 45 71.4 51 Z" fill={c1}/><Cloth d="M50 56 Q100 40 150 56 Q141 64 100 55 Q59 64 50 56 Z" fill={shade(c0, -0.06)} ctx={ctx} v={false}/></G>;
}

export function OverlayParts({ ctx }: { ctx: Ctx }) {
  const { look, p } = ctx;
  const outer = look.items.outerwear;
  const bag = look.items.bag;
  return <G>
    {outer?.item.preview.variant === 'cape' && <Both>
      <Path d="M54 128 Q57 112 78 110 Q90 110 95 116 L89 128 Q76 124 66 133 Q58 140 54 128 Z" fill={`url(#${p}gold)`} stroke="#7A5512" strokeWidth="0.7"/>
      <Path d="M62 124 Q70 116 84 116" stroke="#FFF4C9" strokeWidth="1.2" fill="none" opacity={0.8}/>
      {[66, 74, 82].map(x => <Circle key={x} cx={x} cy={121 - (x - 66) * 0.15} r="1.4" fill="#FFF8DA"/>)}
    </Both>}
    {bag?.item.preview.variant === 'shoulder' && <G transform="translate(128 210) scale(0.6)"><BagArt w={bag} ctx={ctx}/></G>}
    {bag?.item.preview.variant === 'duffel' && <G transform="translate(126 206) scale(0.55)"><BagArt w={bag} ctx={ctx}/></G>}
  </G>;
}

// ------------------------------------------------------------------ svg wrappers
function useSvgId() { return `w${useId().replace(/[^a-zA-Z0-9]/g, '')}`; }

export function LayerSvg({ look, width, height, viewBox = '0 0 200 400', children }: { look: Look; width: number; height: number; viewBox?: string; children: (ctx: Ctx) => React.ReactNode }) {
  const p = useSvgId();
  const ctx = { p, look };
  return <Svg width={width} height={height} viewBox={viewBox} style={{ position: 'absolute', left: 0, top: 0 }}>
    <LookDefs p={p} look={look}/>
    {children(ctx)}
  </Svg>;
}

// ------------------------------------------------------------------ card preview (mannequin)
const ctxItem = (id: string, category: WardrobeCategory, color: string, variant: string): Worn =>
  worn({ id, category, brand: '', name: '', priceCents: null, colors: [color], preview: { variant } });
const GREY_PANTS = ctxItem('ctx-pants', 'bottom', '#B4B4BA', 'joggers');
const GREY_TEE = ctxItem('ctx-tee', 'top', '#8E8E94', 'tee');
const GREY_SNEAKER = ctxItem('ctx-shoe', 'shoes', '#9A9AA0', 'sneaker');

const CROPS: Record<WardrobeCategory, [number, number, number, number]> = {
  top: [38, 104, 124, 146], outerwear: [36, 100, 128, 160], dress: [26, 104, 148, 256], bottom: [40, 192, 120, 166],
  shoes: [58, 286, 84, 72], socks: [58, 280, 84, 78], hat: [44, 6, 112, 96], glasses: [60, 46, 80, 56],
  bag: [-38, -40, 76, 80], accessory: [-30, -26, 60, 70],
};

function fitViewBox([x, y, w, h]: [number, number, number, number], aspect: number): string {
  if (w / h > aspect) { const nh = w / aspect; return `${x} ${y - (nh - h) / 2} ${w} ${nh}`; }
  const nw = h * aspect; return `${x - (nw - w) / 2} ${y} ${nw} ${h}`;
}

export const ItemPreviewArt = React.memo(function ItemPreviewArt({ item, color, width, height }: { item: WardrobeItem; color?: string; width: number; height: number }) {
  const w = worn(item, color);
  const cat = item.category;
  const items: Look['items'] = { [cat]: w };
  if (cat === 'top' || cat === 'outerwear') items.bottom = GREY_PANTS;
  if (cat === 'outerwear') items.top = GREY_TEE;
  if (cat === 'bottom') items.top = GREY_TEE;
  if (cat === 'socks') items.shoes = GREY_SNEAKER;
  const look: Look = { skin: SKIN, hair: DEFAULT_HAIR, mannequin: true, items };
  const viewBox = fitViewBox(CROPS[cat], width / height);
  const standalone = cat === 'bag' || (cat === 'accessory' && item.preview.variant === 'mic');
  return <LayerSvg look={look} width={width} height={height} viewBox={standalone ? viewBox : fitViewBox(cat === 'accessory' ? CROPS.hat : CROPS[cat], width / height)}>
    {ctx => standalone
      ? (cat === 'bag' ? <BagArt w={w} ctx={ctx}/> : <G transform="rotate(-18) translate(0 -6) scale(1.25)"><MicArt w={w}/></G>)
      : <G>
        <BodyParts ctx={ctx}/>
        <ArmParts ctx={ctx} side="L"/>
        <G transform={MIRROR}><ArmParts ctx={ctx} side="R"/></G>
        {(cat === 'hat' || cat === 'glasses' || cat === 'accessory') && <HeadParts ctx={ctx}/>}
        <OverlayParts ctx={ctx}/>
      </G>}
  </LayerSvg>;
});

export { MIRROR };
