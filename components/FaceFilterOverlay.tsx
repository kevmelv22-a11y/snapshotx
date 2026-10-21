import React, { useId, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { balaclavaShape, faceFrame, smoothClosedPath, stickerMatrix, type BalaclavaShape } from '../lib/face-filters/geometry';
import { NEUTRAL_EXPRESSION, effectActive, effectAgeS, type ExpressionState } from '../lib/face-filters/expressions';
import { burstParticles, worldParticles, type Particle, type WorldKind } from '../lib/face-filters/worldEffects';
import { lensTrigger, worldKind } from '../lib/lens-effects';
import type { FaceGeometry, Pt } from '../lib/face-filters/types';
import { photoFilter, type PhotoFilterId } from '../lib/photo-filters';
import { LensArt, hasLensArt } from './LensArt';

type Props = {
  filterId: PhotoFilterId;
  /** Face in the overlay's own coordinates (view points), or null when no face was found. */
  face: FaceGeometry | null;
  width: number;
  height: number;
  /**
   * Live camera preview: cheaper rendering for 15–30 updates per second. The knit is a cached,
   * coarser stitch pattern in face-normalised units that only moves via a transform, and the
   * per-stitch highlights and yarn tufts are skipped. Photos (compose/bake) use the full detail.
   */
  live?: boolean;
  /** Expression state from ExpressionTracker; drives triggered effects (open mouth, smile, blink). */
  expression?: ExpressionState;
  /** Clock for animated effects (world particles, bursts), ms. Same clock as ExpressionTracker. */
  nowMs?: number;
};

/** Draws face lenses on detected landmarks. Tint-only filters are rendered by the parent. */
export function FaceFilterOverlay({ filterId, face, width, height, live = false, expression = NEUTRAL_EXPRESSION, nowMs = 0 }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kind = photoFilter(filterId).kind;
  const world = worldKind(filterId);
  const geometry = useMemo(() => {
    if (kind === 'tint' || kind === 'world' || width <= 0 || height <= 0) return null;
    if (face) return face;
    return kind === 'frame' ? centredFace(width, height) : null;
  }, [face, kind, width, height]);
  const shape = useMemo(() => (geometry && filterId === 'balaclava' ? balaclavaShape(geometry) : null), [geometry, filterId]);
  if (world && width > 0 && height > 0) return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <Particles items={worldParticles(world, nowMs / 1000, { width, height })} />
  </Svg>;
  if (!geometry) return null;
  const trigger = lensTrigger(filterId);
  const on = !!trigger && effectActive(trigger, expression, nowMs);
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {shape ? <Balaclava shape={shape} uid={uid} live={live} />
      : hasLensArt(filterId) ? <LensArt filterId={filterId} face={geometry} width={width} height={height} uid={uid} triggerOn={on} ageS={on && trigger ? effectAgeS(trigger, expression, nowMs) : 0} />
        : <Sticker filterId={filterId} face={geometry} />}
    {on && trigger && !hasLensArt(filterId) && <TriggerEffect filterId={filterId} face={geometry} ageS={effectAgeS(trigger, expression, nowMs)} />}
  </Svg>;
}

/** Default face placement for decorative frames when no face was detected. */
function centredFace(w: number, h: number): FaceGeometry {
  const d = w * 0.22, cx = w / 2, ey = h * 0.4;
  return { bounds: { x: cx - d * 1.1, y: ey - d, width: d * 2.2, height: d * 3 },
    landmarks: { LEFT_EYE: { x: cx + d / 2, y: ey }, RIGHT_EYE: { x: cx - d / 2, y: ey }, MOUTH_LEFT: { x: cx - d * 0.4, y: ey + d * 1.1 }, MOUTH_RIGHT: { x: cx + d * 0.4, y: ey + d * 1.1 } } };
}

const ptAlong = (o: Pt, u: Pt, k: number): Pt => ({ x: o.x + u.x * k, y: o.y + u.y * k });

/**
 * Stockinette knit as plain path geometry (no SVG <Pattern>, which react-native-svg on iOS did not
 * render): one "V" of two yarn legs per stitch, rows stacked downwards, in a frame rotated with the
 * head. Only stitches inside the balaclava's bounding box (in that rotated frame) are emitted.
 */
function knitPaths(shape: BalaclavaShape) {
  const { frame: f, stitch: sw } = shape;
  const sh = sw * 0.82;
  const c = Math.cos(f.roll), s = Math.sin(f.roll);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of shape.outline) {
    const dx = p.x - f.center.x, dy = p.y - f.center.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    minX = Math.min(minX, lx); maxX = Math.max(maxX, lx); minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
  }
  const n = (v: number) => v.toFixed(1);
  let legs = '', legsPurl = '', hiL = '', hiR = '', grooves = '';
  // Columns are aligned to the face centre so the knit "wales" run symmetrically down the face.
  const i0 = Math.floor(minX / sw) - 1, i1 = Math.ceil(maxX / sw) + 1;
  const j0 = Math.floor(minY / sh) - 1, j1 = Math.ceil(maxY / sh) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = i * sw - sw / 2;
    grooves += `M${n(x)} ${n(j0 * sh)}V${n(j1 * sh)}`;
    for (let j = j0; j <= j1; j++) {
      const y = j * sh;
      const leg = `M${n(x + sw * 0.1)} ${n(y - sh * 0.08)}L${n(x + sw * 0.5)} ${n(y + sh * 0.92)}L${n(x + sw * 0.9)} ${n(y - sh * 0.08)}`;
      // Rib knit: alternate columns sit slightly deeper (darker).
      if (i % 2 === 0) legs += leg; else legsPurl += leg;
      hiL += `M${n(x + sw * 0.16)} ${n(y + sh * 0.02)}L${n(x + sw * 0.44)} ${n(y + sh * 0.7)}`;
      hiR += `M${n(x + sw * 0.84)} ${n(y + sh * 0.02)}L${n(x + sw * 0.56)} ${n(y + sh * 0.7)}`;
    }
  }
  const transform = `matrix(${c.toFixed(5)} ${s.toFixed(5)} ${(-s).toFixed(5)} ${c.toFixed(5)} ${n(f.center.x)} ${n(f.center.y)})`;
  return { legs, legsPurl, hiL, hiR, grooves, transform, sw };
}

/** Live knit: generated once in eye-distance units (d = 1) over a box that covers any balaclava. */
const LIVE_STITCH = 1 / 7.5;
let liveKnitCache: { legs: string; legsPurl: string; grooves: string } | null = null;
function liveKnit() {
  if (liveKnitCache) return liveKnitCache;
  const sw = LIVE_STITCH, sh = sw * 0.82;
  const n = (v: number) => v.toFixed(3);
  let legs = '', legsPurl = '', grooves = '';
  const i0 = Math.floor(-1.9 / sw), i1 = Math.ceil(1.9 / sw), j0 = Math.floor(-2.9 / sh), j1 = Math.ceil(2.9 / sh);
  for (let i = i0; i <= i1; i++) {
    const x = i * sw - sw / 2;
    grooves += `M${n(x)} ${n(j0 * sh)}V${n(j1 * sh)}`;
    for (let j = j0; j <= j1; j++) {
      const y = j * sh;
      const leg = `M${n(x + sw * 0.1)} ${n(y - sh * 0.08)}L${n(x + sw * 0.5)} ${n(y + sh * 0.92)}L${n(x + sw * 0.9)} ${n(y - sh * 0.08)}`;
      if (i % 2 === 0) legs += leg; else legsPurl += leg;
    }
  }
  liveKnitCache = { legs, legsPurl, grooves };
  return liveKnitCache;
}
/** Memoised so per-frame overlay updates never re-send the (large) stitch paths to native. */
const LiveKnitPaths = React.memo(function LiveKnitPaths() {
  const k = liveKnit(), sw = LIVE_STITCH;
  return <G>
    <Path d={k.grooves} fill="none" stroke="#030304" strokeWidth={sw * 0.12} />
    <Path d={k.legs} fill="none" stroke="#25262c" strokeWidth={sw * 0.38} strokeLinecap="round" strokeLinejoin="round" />
    <Path d={k.legsPurl} fill="none" stroke="#18191d" strokeWidth={sw * 0.36} strokeLinecap="round" strokeLinejoin="round" />
  </G>;
});

/** Black knitted balaclava: procedural knit texture, soft edges and shading, no outline. */
function Balaclava({ shape, uid, live }: { shape: BalaclavaShape; uid: string; live: boolean }) {
  const { frame: f, stitch: sw } = shape;
  const d = f.eyeDist;
  const knit = useMemo(() => (live ? null : knitPaths(shape)), [shape, live]);
  const c = Math.cos(f.roll), si = Math.sin(f.roll);
  const liveTransform = `matrix(${(d * c).toFixed(4)} ${(d * si).toFixed(4)} ${(-d * si).toFixed(4)} ${(d * c).toFixed(4)} ${f.center.x.toFixed(2)} ${f.center.y.toFixed(2)})`;
  const light = ptAlong(f.center, f.uy, -0.55 * d);
  const neckEnd = ptAlong(f.center, f.uy, 2.6 * d);
  const holes = [...shape.eyes, shape.mouth];
  const holeD = holes.map((h) => smoothClosedPath(h.points));
  const id = (n: string) => `${n}${uid}`;
  return <G>
    <Defs>
      <ClipPath id={id('mask')}><Path d={shape.d} fillRule="evenodd" clipRule="evenodd" /></ClipPath>
      <RadialGradient id={id('shade')} gradientUnits="userSpaceOnUse" cx={light.x} cy={light.y} r={2.3 * d} fx={light.x} fy={light.y}>
        <Stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
        <Stop offset="0.35" stopColor="#ffffff" stopOpacity="0.02" />
        <Stop offset="0.62" stopColor="#000000" stopOpacity="0.12" />
        <Stop offset="0.88" stopColor="#000000" stopOpacity="0.5" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.7" />
      </RadialGradient>
      <LinearGradient id={id('neck')} gradientUnits="userSpaceOnUse" x1={f.center.x} y1={f.center.y} x2={neckEnd.x} y2={neckEnd.y}>
        <Stop offset="0" stopColor="#000000" stopOpacity="0" />
        <Stop offset="0.55" stopColor="#000000" stopOpacity="0.05" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.45" />
      </LinearGradient>
      {holeD.map((hd, i) => <ClipPath key={i} id={id(`hole${i}`)}><Path d={hd} /></ClipPath>)}
    </Defs>
    <Path d={shape.d} fillRule="evenodd" fill="#09090b" />
    <G clipPath={`url(#${id('mask')})`}>
      {knit ? <G transform={knit.transform}>
        <Path d={knit.grooves} fill="none" stroke="#030304" strokeWidth={sw * 0.12} />
        <Path d={knit.legs} fill="none" stroke="#202126" strokeWidth={sw * 0.36} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={knit.legsPurl} fill="none" stroke="#17181c" strokeWidth={sw * 0.34} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={knit.hiL} fill="none" stroke="#34363d" strokeWidth={sw * 0.11} strokeLinecap="round" />
        <Path d={knit.hiR} fill="none" stroke="#2b2d33" strokeWidth={sw * 0.1} strokeLinecap="round" />
      </G> : <G transform={liveTransform}><LiveKnitPaths /></G>}
      <Path d={shape.d} fillRule="evenodd" fill={`url(#${id('shade')})`} />
      <Path d={shape.d} fillRule="evenodd" fill={`url(#${id('neck')})`} />
    </G>
    {/* Soft edge instead of an outline: a translucent feather plus short yarn tufts in the fabric colour. */}
    <Path d={shape.outlineD} fill="none" stroke="#060607" strokeOpacity={0.35} strokeWidth={0.05 * d} strokeLinejoin="round" />
    {!live && <Path d={shape.outlineD} fill="none" stroke="#060607" strokeOpacity={0.8} strokeWidth={0.035 * d} strokeDasharray={`${(sw * 0.12).toFixed(2)} ${(sw * 0.22).toFixed(2)}`} strokeLinecap="round" strokeLinejoin="round" />}
    {/* Holes: shadow cast on the skin + a thicker ribbed rim. */}
    {holeD.map((hd, i) => <G key={i} clipPath={`url(#${id(`hole${i}`)})`}>
      <Path d={hd} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={0.12 * d} />
      <Path d={hd} fill="none" stroke="#000000" strokeOpacity={0.22} strokeWidth={0.26 * d} />
    </G>)}
    {holeD.map((hd, i) => <G key={`rim${i}`}>
      <Path d={hd} fill="none" stroke="#0d0e10" strokeWidth={0.085 * d} />
      {!live && <Path d={hd} fill="none" stroke="#2c2e34" strokeWidth={0.07 * d} strokeDasharray={`${(sw * 0.16).toFixed(2)} ${(sw * 0.3).toFixed(2)}`} />}
      <Path d={hd} fill="none" stroke="#3a3c43" strokeOpacity={0.35} strokeWidth={0.025 * d} />
    </G>)}
  </G>;
}

/** Artwork in a 300x330 design space; `anchors` = image-left eye, image-right eye, mouth in that space. */
const STICKERS: Partial<Record<PhotoFilterId, { anchors: [Pt, Pt, Pt]; art: React.ReactNode }>> = {
  dog: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M62 82 Q12 37 30 153 Q43 178 86 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
    <Path d="M238 82 Q288 37 270 153 Q257 178 214 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
    <Path d="M52 98 Q34 74 43 137 L69 126 Z M248 98 Q266 74 257 137 L231 126 Z" fill="#DFA783"/>
    <Ellipse cx="150" cy="210" rx="33" ry="23" fill="#B97850" opacity=".82"/>
    <Path d="M133 203 Q150 189 167 203 Q169 222 150 226 Q131 222 133 203 Z" fill="#39231F"/>
    <Path d="M150 226 Q150 241 137 241 M150 226 Q150 241 163 241" stroke="#39231F" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </G> },
  cat: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M54 139 L61 34 Q66 25 77 42 L115 83 M246 139 L239 34 Q234 25 223 42 L185 83" fill="#5D405F" stroke="#E5A6CD" strokeWidth="7" strokeLinejoin="round"/>
    <Path d="M73 64 L80 111 L106 91 M227 64 L220 111 L194 91" fill="#F4A5C6"/>
    <Path d="M139 213 Q150 204 161 213 L150 225 Z" fill="#EC93AC"/>
    <Line x1="121" y1="228" x2="50" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="121" y1="235" x2="54" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="179" y1="228" x2="250" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="179" y1="235" x2="246" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
  </G> },
  rabbit: { anchors: [{ x: 112, y: 165 }, { x: 188, y: 165 }, { x: 150, y: 249 }], art: <G>
    <Path d="M81 115 Q43 -34 70 16 Q105 32 113 112 M219 115 Q257 -34 230 16 Q195 32 187 112" fill="#E9E4F0" stroke="#BDB2CE" strokeWidth="5"/>
    <Path d="M82 94 Q63 12 76 34 L98 105 M218 94 Q237 12 224 34 L202 105" fill="#F6AECF"/>
    <Ellipse cx="150" cy="216" rx="13" ry="9" fill="#F3A0C4"/>
    <Path d="M150 225 L150 239 M135 238 Q150 248 165 238" stroke="#F3A0C4" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </G> },
  sunglasses: { anchors: [{ x: 97, y: 187 }, { x: 203, y: 187 }, { x: 150, y: 304 }], art: <G>
    <Path d="M52 154 L105 157 Q137 154 140 178 Q138 212 107 219 Q68 221 58 188 Z M248 154 L195 157 Q163 154 160 178 Q162 212 193 219 Q232 221 242 188 Z"
      fill="#181924" fillOpacity={0.92} stroke="#D6B365" strokeWidth="7"/>
    <Path d="M140 173 Q150 164 160 173 M52 162 L27 150 M248 162 L273 150" fill="none" stroke="#D6B365" strokeWidth="8" strokeLinecap="round"/>
    <Path d="M70 175 L113 169 M181 175 L224 169" stroke="#8B8FAE" opacity=".55" strokeWidth="5"/>
  </G> },
  crown: { anchors: [{ x: 100, y: 244 }, { x: 200, y: 244 }, { x: 150, y: 354 }], art: <G>
    <Path d="M50 113 L38 34 L94 71 L150 13 L206 71 L262 34 L250 113 Z" fill="#FFC83D" stroke="#9C6A1B" strokeWidth="6" strokeLinejoin="round"/>
    <Rect x="50" y="110" width="200" height="24" rx="8" fill="#EAAA22" stroke="#9C6A1B" strokeWidth="5"/>
    <Circle cx="150" cy="91" r="12" fill="#C92A79"/><Circle cx="84" cy="97" r="8" fill="#7545C4"/><Circle cx="216" cy="97" r="8" fill="#7545C4"/>
  </G> },
  dragon: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M78 92 Q52 40 70 8 Q80 52 104 80 Z M222 92 Q248 40 230 8 Q220 52 196 80 Z" fill="#3F9E4A" stroke="#1D5B27" strokeWidth="5" strokeLinejoin="round"/>
    <Path d="M86 70 L96 60 M214 70 L204 60" stroke="#B9F27A" strokeWidth="4" strokeLinecap="round"/>
    <Path d="M95 130 Q112 118 130 132 M205 130 Q188 118 170 132" stroke="#1D5B27" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <Path d="M138 205 Q150 197 162 205" stroke="#1D5B27" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Circle cx="140" cy="209" r="3" fill="#1D5B27"/><Circle cx="160" cy="209" r="3" fill="#1D5B27"/>
    <Path d="M40 175 L20 160 L36 190 Z M260 175 L280 160 L264 190 Z" fill="#3F9E4A" stroke="#1D5B27" strokeWidth="4" strokeLinejoin="round"/>
  </G> },
  rainbow: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M80 70 Q80 40 110 44 Q118 18 150 26 Q182 18 190 44 Q220 40 220 70 Q222 92 196 92 L104 92 Q78 92 80 70 Z" fill="#FFFFFF" stroke="#B7C6E6" strokeWidth="5"/>
    <Circle cx="96" cy="196" r="13" fill="#FF8FB8" opacity=".55"/><Circle cx="204" cy="196" r="13" fill="#FF8FB8" opacity=".55"/>
  </G> },
  blush: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Ellipse cx="92" cy="203" rx="24" ry="13" fill="#FF5C8A" opacity=".5"/><Ellipse cx="208" cy="203" rx="24" ry="13" fill="#FF5C8A" opacity=".5"/>
    <Path d="M80 203 L86 196 M92 205 L98 198 M104 203 L110 196 M190 203 L196 196 M202 205 L208 198 M214 203 L220 196" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity=".8"/>
  </G> },
  sparkle: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M84 138 Q112 116 140 138 M160 138 Q188 116 216 138" stroke="#C77DFF" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".75"/>
    <Path d={star(72, 128, 9)} fill="#FFF6A8"/><Path d={star(228, 128, 9)} fill="#FFF6A8"/><Path d={star(150, 112, 6)} fill="#FFFFFF"/>
  </G> },
  clown: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Circle cx="60" cy="96" r="34" fill="#FF7A00"/><Circle cx="240" cy="96" r="34" fill="#FF7A00"/><Circle cx="84" cy="64" r="26" fill="#FF9A1F"/><Circle cx="216" cy="64" r="26" fill="#FF9A1F"/>
    <Path d="M112 128 L112 192 M188 128 L188 192 M100 160 L124 160 M176 160 L200 160" stroke="#2E5BFF" strokeWidth="5" strokeLinecap="round" opacity=".7"/>
    <Circle cx="150" cy="206" r="20" fill="#E8112D"/><Circle cx="143" cy="199" r="6" fill="#FFFFFF" opacity=".6"/>
    <Path d="M112 240 Q150 268 188 240" stroke="#E8112D" strokeWidth="9" fill="none" strokeLinecap="round"/>
  </G> },
  devil: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M88 92 Q70 50 96 20 Q94 60 120 82 Z M212 92 Q230 50 204 20 Q206 60 180 82 Z" fill="#E0142E" stroke="#7A0010" strokeWidth="5" strokeLinejoin="round"/>
    <Path d="M95 138 L130 148 M205 138 L170 148" stroke="#7A0010" strokeWidth="6" strokeLinecap="round"/>
    <Path d="M128 286 Q150 300 172 286 L150 318 Z" fill="#3A0A10" opacity=".85"/>
  </G> },
  halo: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Ellipse cx="150" cy="22" rx="70" ry="16" fill="none" stroke="#FFE36E" strokeWidth="10"/>
    <Ellipse cx="150" cy="22" rx="70" ry="16" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity=".8"/>
    <Path d="M30 250 Q-30 200 -10 140 Q20 190 60 200 Q20 210 30 250 Z M270 250 Q330 200 310 140 Q280 190 240 200 Q280 210 270 250 Z" fill="#FFFFFF" stroke="#D9E4F2" strokeWidth="4" opacity=".92"/>
  </G> },
  hearts: { anchors: [{ x: 115, y: 160 }, { x: 185, y: 160 }, { x: 150, y: 237 }], art: <G fill="#F451A6" stroke="#FFF0F8" strokeWidth="3">
    <Path d="M54 118 C23 83 7 125 54 155 C101 125 85 83 54 118 Z"/>
    <Path d="M245 91 C215 56 198 99 245 129 C292 99 275 56 245 91 Z"/>
    <Path d="M240 232 C216 204 201 239 240 266 C279 239 264 204 240 232 Z"/>
    <Path d="M89 254 C71 231 54 259 89 281 C124 259 107 231 89 254 Z"/>
  </G> },
};

function star(cx: number, cy: number, r: number, points = 5): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}
const HEART = 'M0 0.35 C-0.55 -0.15 -0.3 -0.7 0 -0.32 C0.3 -0.7 0.55 -0.15 0 0.35 Z';

/** Particles in view points (world lenses and bursts); shapes are drawn in unit size and scaled. */
function Particles({ items }: { items: Particle[] }) {
  return <G>{items.map((p, i) => {
    const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rotDeg.toFixed(1)}) scale(${p.size.toFixed(2)})`;
    return <G key={i} transform={t} opacity={p.opacity}>
      {p.shape === 'rect' ? <Rect x={-0.5} y={-0.25} width={1} height={0.5} fill={p.color} />
        : p.shape === 'dot' ? <Circle r={0.5} fill={p.color} />
          : p.shape === 'heart' ? <Path d={HEART} fill={p.color} />
            : <Path d={star(0, 0, 0.5)} fill={p.color} />}
    </G>;
  })}</G>;
}

/** Effect shown while the lens trigger is active, in the same 300x330 design space as the sticker. */
function TriggerEffect({ filterId, face, ageS }: { filterId: PhotoFilterId; face: FaceGeometry; ageS: number }) {
  const anchors: [Pt, Pt, Pt] = [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }];
  const m = stickerMatrix(face, anchors).map((v) => v.toFixed(4)).join(' ');
  const flick = Math.sin(ageS * 40) * 6;
  if (filterId === 'dragon') return <G transform={`matrix(${m})`}>
    <Path d={`M132 246 Q${100 + flick} 330 ${70 + flick} 470 Q150 ${430 - flick} ${230 - flick} 470 Q${200 - flick} 330 168 246 Z`} fill="#FF5A1F" opacity=".92"/>
    <Path d={`M138 248 Q${120 - flick} 320 ${108} 420 Q150 ${396 + flick} 192 420 Q${180 + flick} 320 162 248 Z`} fill="#FFB020"/>
    <Path d={`M144 250 Q${138 + flick / 2} 300 136 360 Q150 350 164 360 Q${162 - flick / 2} 300 156 250 Z`} fill="#FFF3A0"/>
  </G>;
  if (filterId === 'rainbow') {
    const bands = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#0A84FF', '#AF52DE'];
    const len = Math.min(1, ageS / 0.35) * 260; // the rainbow "pours" out over 350 ms
    return <G transform={`matrix(${m})`}>{bands.map((c, i) => {
      const x = 126 + i * 8;
      return <Path key={c} d={`M${x} 250 Q${x - 10} ${250 + len * 0.5} ${x - 40 + i * 4} ${250 + len}`} stroke={c} strokeWidth="9" fill="none" strokeLinecap="round"/>;
    })}</G>;
  }
  const f = faceFrame(face), d = f.eyeDist;
  const at = (o: Pt, kx: number, ky: number): Pt => ({ x: o.x + f.ux.x * kx * d + f.uy.x * ky * d, y: o.y + f.ux.y * kx * d + f.uy.y * ky * d });
  if (filterId === 'blush') {
    const pink = ['#FF3E8A', '#FF8FB8', '#FFFFFF'];
    return <G>
      <Particles items={[...burstParticles(at(f.eyeL, -0.25, 0.6), ageS % 0.9, d, 3, 'heart', pink, 8), ...burstParticles(at(f.eyeR, 0.25, 0.6), (ageS + 0.45) % 0.9, d, 5, 'heart', pink, 8)]} />
      {[f.eyeL, f.eyeR].map((e, i) => <G key={i} transform={`translate(${e.x.toFixed(1)} ${e.y.toFixed(1)}) rotate(${(f.roll * 180 / Math.PI).toFixed(1)}) scale(${(d * 0.55).toFixed(2)})`}><Path d={HEART} fill="#FF2D6F" /></G>)}
    </G>;
  }
  if (filterId === 'sparkle') return <Particles items={[...burstParticles(f.eyeL, ageS, d, 11), ...burstParticles(f.eyeR, ageS, d, 13)]} />;
  return null;
}

function Sticker({ filterId, face }: { filterId: PhotoFilterId; face: FaceGeometry }) {
  const sticker = STICKERS[filterId];
  if (!sticker) return null;
  const m = stickerMatrix(face, sticker.anchors).map((v) => v.toFixed(4)).join(' ');
  return <G transform={`matrix(${m})`}>{sticker.art}</G>;
}

