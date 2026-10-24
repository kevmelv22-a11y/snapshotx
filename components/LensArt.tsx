import React from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { balaclavaShape } from '../lib/face-filters/geometry';
import { lensAnchors, wingFeathers, wingLayout, type LensAnchors, type WingLayout } from '../lib/face-filters/anchors';
import { rand, burstParticles, type Particle } from '../lib/face-filters/worldEffects';
import type { FaceGeometry, Pt } from '../lib/face-filters/types';
import type { PhotoFilterId } from '../lib/photo-filters';

/**
 * Shaded face lenses (step 3): drawn in a face-local frame (origin = eye midpoint, unit = eye
 * distance) that is anchored to the eyes and the upper face only, so head-attached art never
 * stretches when the mouth opens. Realism comes from layered gradients instead of flat fills:
 * cylinder shading + specular highlights on horns/nose, radial falloff for make-up (blends into the
 * skin), soft contact shadows where art meets the head, and glow layers for light sources.
 * Only SVG features that react-native-svg renders on iOS, Android and web are used.
 */
export const LENS_ART_IDS: readonly PhotoFilterId[] = ['dragon', 'rainbow', 'blush', 'sparkle', 'clown', 'devil', 'halo'];
export const hasLensArt = (id: PhotoFilterId) => LENS_ART_IDS.includes(id);

type Props = { filterId: PhotoFilterId; face: FaceGeometry; width: number; height: number; uid: string; triggerOn: boolean; ageS: number };

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const pts = (p: Pt[]) => p.map((q, i) => `${i ? 'L' : 'M'}${n(q.x)} ${n(q.y)}`).join('') + 'Z';
/** Closed Catmull-Rom spline (like geometry.smoothClosedPath, but with 3 decimals for eye-distance units). */
function smoothClosedPath(p: Pt[]): string {
  const k = p.length;
  if (k < 3) return '';
  let d = `M${n(p[0].x)} ${n(p[0].y)}`;
  for (let i = 0; i < k; i++) {
    const p0 = p[(i - 1 + k) % k], p1 = p[i], p2 = p[(i + 1) % k], p3 = p[(i + 2) % k];
    d += `C${n(p1.x + (p2.x - p0.x) / 6)} ${n(p1.y + (p2.y - p0.y) / 6)} ${n(p2.x - (p3.x - p1.x) / 6)} ${n(p2.y - (p3.y - p1.y) / 6)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return `${d}Z`;
}
const scaleAbout = (p: Pt[], c: Pt, k: number, ky = k) => p.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * ky }));

export function LensArt({ filterId, face, width, height, uid, triggerOn, ageS }: Props) {
  const a = lensAnchors(face);
  const id = (s: string) => `${s}${uid}`;
  const local = (children: React.ReactNode) => <G transform={`matrix(${a.matrix.map((v) => v.toFixed(4)).join(' ')})`}>{children}</G>;
  switch (filterId) {
    case 'devil': return local(<Devil a={a} id={id} />);
    case 'dragon': return <G>{local(<Dragon a={a} id={id} fire={triggerOn} ageS={ageS} />)}</G>;
    case 'rainbow': return local(<RainbowCloud a={a} id={id} pour={triggerOn} ageS={ageS} />);
    case 'blush': return <G>{local(<Blush a={a} id={id} />)}{triggerOn && <HeartBurst a={a} id={id} ageS={ageS} />}</G>;
    case 'sparkle': return <G>{local(<StarEyes a={a} id={id} />)}{triggerOn && <StarBurst a={a} id={id} ageS={ageS} />}</G>;
    case 'clown': return local(<Clown a={a} id={id} />);
    case 'halo': {
      // Wings sit behind the person: clip them with the inverse of the head+neck silhouette
      // (the balaclava outline: face oval grown over the skull/hair plus a neck tube).
      const head = balaclavaShape(face).outlineD;
      return <G>
        <Defs><ClipPath id={id('behind')}><Path d={`M-10 -10H${width + 10}V${height + 10}H-10Z ${head}`} fillRule="evenodd" clipRule="evenodd" /></ClipPath></Defs>
        <G clipPath={`url(#${id('behind')})`}>{wingLayout(face, { width, height }).map((w) => <Wing key={w.side} w={w} id={id} />)}</G>
        {local(<Halo a={a} id={id} />)}
      </G>;
    }
    default: return null;
  }
}

type Id = (s: string) => string;

/** Soft elliptical contact shadow (darkest in the middle, fades to nothing). */
function SoftShadow({ id, name, cx, cy, rx, ry, opacity = 0.45, color = '#000000' }: { id: Id; name: string; cx: number; cy: number; rx: number; ry: number; opacity?: number; color?: string }) {
  return <G>
    <Defs><RadialGradient id={id(name)} cx="50%" cy="50%" r="50%">
      <Stop offset="0" stopColor={color} stopOpacity={opacity} /><Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} /><Stop offset="1" stopColor={color} stopOpacity="0" />
    </RadialGradient></Defs>
    <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id(name)})`} />
  </G>;
}

type HornLook = { dark: string; mid: string; light: string; tip: string; ridges?: boolean };
/** A curved, shaded horn growing up from `base`; side -1/+1 mirrors the curl outwards. */
function Horn({ id, name, base, side, len, w, tiltDeg, curl, look }: { id: Id; name: string; base: Pt; side: -1 | 1; len: number; w: number; tiltDeg: number; curl: number; look: HornLook }) {
  const tx = side * curl, h = w / 2;
  const d = `M${n(-h)} 0C${n(-h)} ${n(-len * 0.45)} ${n(tx * 0.3 - w * 0.22)} ${n(-len * 0.86)} ${n(tx)} ${n(-len)}`
    + `C${n(tx * 0.45 + w * 0.26)} ${n(-len * 0.78)} ${n(h)} ${n(-len * 0.42)} ${n(h)} 0Q0 ${n(w * 0.2)} ${n(-h)} 0Z`;
  const along = (t: number): Pt => ({ x: tx * t * t, y: -len * t });
  const ridges = look.ridges ? [0.16, 0.3, 0.44, 0.57, 0.69, 0.8].map((t) => {
    const c = along(t), hw = h * (1 - t * 0.92);
    return `M${n(c.x - hw)} ${n(c.y + hw * 0.08)}Q${n(c.x)} ${n(c.y + hw * 0.42)} ${n(c.x + hw)} ${n(c.y + hw * 0.08)}`;
  }).join('') : '';
  const spec = `M${n(-h * 0.35)} ${n(-len * 0.06)}C${n(-h * 0.4)} ${n(-len * 0.4)} ${n(tx * 0.3 - w * 0.1)} ${n(-len * 0.72)} ${n(tx * 0.86)} ${n(-len * 0.93)}`;
  return <G transform={`translate(${n(base.x)} ${n(base.y)}) rotate(${n(side * tiltDeg)})`}>
    <Defs>
      <LinearGradient id={id(`${name}x`)} gradientUnits="userSpaceOnUse" x1={-h} y1="0" x2={h} y2="0">
        <Stop offset="0" stopColor={look.dark} /><Stop offset="0.28" stopColor={look.mid} /><Stop offset="0.48" stopColor={look.light} />
        <Stop offset="0.72" stopColor={look.mid} /><Stop offset="1" stopColor={look.dark} />
      </LinearGradient>
      <LinearGradient id={id(`${name}y`)} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={-len}>
        <Stop offset="0" stopColor="#000000" stopOpacity="0.55" /><Stop offset="0.3" stopColor="#000000" stopOpacity="0" />
        <Stop offset="0.8" stopColor={look.tip} stopOpacity="0" /><Stop offset="1" stopColor={look.tip} stopOpacity="0.55" />
      </LinearGradient>
      {/* the base grows out of the skin: fade the bottom ~12% instead of a hard cut */}
      <LinearGradient id={id(`${name}f`)} gradientUnits="userSpaceOnUse" x1="0" y1={w * 0.2} x2="0" y2={-len * 0.14}>
        <Stop offset="0" stopColor="#ffffff" stopOpacity="0" /><Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.7" /><Stop offset="1" stopColor="#ffffff" stopOpacity="1" />
      </LinearGradient>
      <Mask id={id(`${name}k`)} maskUnits="userSpaceOnUse" x={-w * 2} y={-len * 1.2} width={w * 4 + len} height={len * 1.5}>
        <Rect x={-w * 2} y={-len * 1.2} width={w * 4 + len} height={len * 1.5} fill={`url(#${id(`${name}f`)})`} />
      </Mask>
    </Defs>
    <SoftShadow id={id} name={`${name}s`} cx={0} cy={w * 0.02} rx={w * 1.05} ry={w * 0.32} opacity={0.5} />
    <G mask={`url(#${id(`${name}k`)})`}>
      <Path d={d} fill={`url(#${id(`${name}x`)})`} />
      <Path d={d} fill={`url(#${id(`${name}y`)})`} />
      {!!ridges && <Path d={ridges} fill="none" stroke={look.dark} strokeOpacity={0.5} strokeWidth={w * 0.05} strokeLinecap="round" />}
      <Path d={spec} fill="none" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={w * 0.07} strokeLinecap="round" />
      <Path d={d} fill="none" stroke={look.dark} strokeOpacity={0.35} strokeWidth={w * 0.025} />
    </G>
  </G>;
}

function Devil({ a, id }: { a: LensAnchors; id: Id }) {
  const look: HornLook = { dark: '#3d0007', mid: '#a3101d', light: '#ff5a4f', tip: '#ffd2c8' };
  const y = a.top.y + 0.08, dx = 0.44;
  return <G>
    {/* faint warm red cast on the forehead around the horns */}
    <SoftShadow id={id} name="dvg" cx={a.top.x} cy={a.top.y + 0.25} rx={0.95} ry={0.4} opacity={0.08} color="#ff1a1a" />
    <Horn id={id} name="dvl" base={{ x: a.top.x - dx, y }} side={-1} len={0.74} w={0.28} tiltDeg={14} curl={0.15} look={look} />
    <Horn id={id} name="dvr" base={{ x: a.top.x + dx, y }} side={1} len={0.74} w={0.28} tiltDeg={14} curl={0.15} look={look} />
  </G>;
}

/** Overlapping scale texture over an elliptical patch that fades into the skin (mask). */
function ScalePatch({ id, name, c, rx, ry, rotDeg = 0, size = 0.085 }: { id: Id; name: string; c: Pt; rx: number; ry: number; rotDeg?: number; size?: number }) {
  let dk = '', hi = '';
  const sh = size * 0.62;
  for (let j = -Math.ceil(ry / sh) - 1, row = 0; j <= Math.ceil(ry / sh) + 1; j++, row++) {
    for (let i = -Math.ceil(rx / size) - 1; i <= Math.ceil(rx / size) + 1; i++) {
      const x = i * size + (row % 2 ? size / 2 : 0), y = j * sh;
      dk += `M${n(x - size / 2)} ${n(y)}Q${n(x - size / 2)} ${n(y + sh * 1.1)} ${n(x)} ${n(y + sh * 1.15)}Q${n(x + size / 2)} ${n(y + sh * 1.1)} ${n(x + size / 2)} ${n(y)}`;
      hi += `M${n(x - size * 0.3)} ${n(y + sh * 0.35)}Q${n(x)} ${n(y + sh * 0.6)} ${n(x + size * 0.3)} ${n(y + sh * 0.35)}`;
    }
  }
  return <G transform={`translate(${n(c.x)} ${n(c.y)}) rotate(${n(rotDeg)})`}>
    <Defs>
      <RadialGradient id={id(`${name}m`)} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#ffffff" stopOpacity="0.9" /><Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.55" /><Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </RadialGradient>
      <Mask id={id(`${name}k`)} maskUnits="userSpaceOnUse" x={-rx} y={-ry} width={rx * 2} height={ry * 2}>
        <Ellipse cx={0} cy={0} rx={rx} ry={ry} fill={`url(#${id(`${name}m`)})`} />
      </Mask>
    </Defs>
    <G mask={`url(#${id(`${name}k`)})`}>
      <Ellipse cx={0} cy={0} rx={rx} ry={ry} fill="#2f6d2a" fillOpacity={0.22} />
      <Path d={dk} fill="none" stroke="#123d16" strokeOpacity={0.38} strokeWidth={size * 0.1} />
      <Path d={hi} fill="none" stroke="#c8f59a" strokeOpacity={0.35} strokeWidth={size * 0.08} strokeLinecap="round" />
    </G>
  </G>;
}

function Dragon({ a, id, fire, ageS }: { a: LensAnchors; id: Id; fire: boolean; ageS: number }) {
  const look: HornLook = { dark: '#22331a', mid: '#6b7d3a', light: '#e2e7b0', tip: '#fffbe0', ridges: true };
  const y = a.top.y + 0.1, dx = 0.5;
  return <G>
    <ScalePatch id={id} name="dsl" c={{ x: -(a.halfWL * 0.92), y: -0.45 }} rx={0.24} ry={0.42} rotDeg={10} size={0.06} />
    <ScalePatch id={id} name="dsr" c={{ x: a.halfWR * 0.92, y: -0.45 }} rx={0.24} ry={0.42} rotDeg={-10} size={0.06} />
    <ScalePatch id={id} name="dcl" c={{ x: -(a.halfWL * 0.85), y: 0.45 }} rx={0.18} ry={0.3} rotDeg={-8} size={0.05} />
    <ScalePatch id={id} name="dcr" c={{ x: a.halfWR * 0.85, y: 0.45 }} rx={0.18} ry={0.3} rotDeg={8} size={0.05} />
    <Horn id={id} name="drl" base={{ x: a.top.x - dx, y }} side={-1} len={0.95} w={0.32} tiltDeg={24} curl={0.4} look={look} />
    <Horn id={id} name="drr" base={{ x: a.top.x + dx, y }} side={1} len={0.95} w={0.32} tiltDeg={24} curl={0.4} look={look} />
    {fire && <Fire a={a} id={id} ageS={ageS} />}
  </G>;
}

/** Fire breath from the (real, moving) mouth: layered flame tongues with glow lighting the chin. */
function Fire({ a, id, ageS }: { a: LensAnchors; id: Id; ageS: number }) {
  const m = a.mouth, w0 = Math.max(0.16, a.mouthHalfW * 0.75);
  const grow = Math.min(1, 0.35 + ageS / 0.4), L = 1.9 * grow;
  const fl = (k: number, i: number) => Math.sin(ageS * 23 + i * 1.7) * 0.06 * k;
  const tongue = (k: number, wk: number, i: number) => {
    const w = w0 * wk, len = L * k;
    return `M${n(m.x - w * 0.55)} ${n(m.y)}C${n(m.x - w * 1.6 + fl(1, i))} ${n(m.y + len * 0.35)} ${n(m.x - w * 2.3 + fl(2, i))} ${n(m.y + len * 0.7)} ${n(m.x + fl(3, i))} ${n(m.y + len)}`
      + `C${n(m.x + w * 2.3 + fl(2, i + 1))} ${n(m.y + len * 0.7)} ${n(m.x + w * 1.6 + fl(1, i + 1))} ${n(m.y + len * 0.35)} ${n(m.x + w * 0.55)} ${n(m.y)}Z`;
  };
  const grad = (name: string, c0: string, c1: string, len: number) => <LinearGradient id={id(name)} gradientUnits="userSpaceOnUse" x1={m.x} y1={m.y - 0.05} x2={m.x} y2={m.y + len}>
    <Stop offset="0" stopColor={c0} stopOpacity="0" /><Stop offset="0.12" stopColor={c0} stopOpacity="0.9" /><Stop offset="0.45" stopColor={c1} stopOpacity="0.7" /><Stop offset="1" stopColor={c1} stopOpacity="0" />
  </LinearGradient>;
  return <G>
    <Defs>{grad('fo', '#ff6a00', '#d42000', L)}{grad('fm', '#ffb000', '#ff5a00', L * 0.8)}{grad('fc', '#fffbe6', '#ffd23a', L * 0.55)}</Defs>
    <SoftShadow id={id} name="fglow" cx={m.x} cy={m.y + 0.35} rx={1.5} ry={1.0} opacity={0.4} color="#ff8a1a" />
    <Path d={tongue(1.12, 1.7, 7)} fill={`url(#${id('fo')})`} opacity={0.35} />
    <Path d={tongue(1, 1.15, 0)} fill={`url(#${id('fo')})`} opacity={0.85} />
    <Path d={tongue(0.9, 0.5, 9)} transform={`translate(${n(-w0 * 0.9)} 0)`} fill={`url(#${id('fm')})`} opacity={0.6} />
    <Path d={tongue(0.85, 0.45, 11)} transform={`translate(${n(w0 * 0.9)} 0)`} fill={`url(#${id('fm')})`} opacity={0.6} />
    <Path d={tongue(0.82, 0.9, 2)} fill={`url(#${id('fm')})`} />
    <Path d={tongue(0.55, 0.55, 4)} fill={`url(#${id('fc')})`} />
    <SoftShadow id={id} name="fcore" cx={m.x} cy={m.y + 0.05} rx={w0 * 1.3} ry={0.18} opacity={0.9} color="#fff6c8" />
  </G>;
}

const CLOUD: [number, number, number][] = [[-0.62, 0.06, 0.27], [-0.3, -0.12, 0.36], [0.1, -0.22, 0.42], [0.48, -0.08, 0.34], [0.76, 0.08, 0.24], [-0.05, 0.08, 0.34], [0.36, 0.1, 0.3]];

function RainbowCloud({ a, id, pour, ageS }: { a: LensAnchors; id: Id; pour: boolean; ageS: number }) {
  const c = { x: a.top.x, y: a.top.y - 1.05 };
  const circles = CLOUD.map(([x, y, r]) => ({ x: c.x + x, y: c.y + y, r }));
  const minY = Math.min(...circles.map((q) => q.y - q.r)), maxY = Math.max(...circles.map((q) => q.y + q.r));
  return <G>
    <Defs>
      <RadialGradient id={id('cp')} cx="42%" cy="35%" r="65%" fx="38%" fy="28%">
        <Stop offset="0" stopColor="#ffffff" /><Stop offset="0.6" stopColor="#f4f7fc" /><Stop offset="1" stopColor="#cfd9e8" />
      </RadialGradient>
      <LinearGradient id={id('cu')} gradientUnits="userSpaceOnUse" x1="0" y1={minY} x2="0" y2={maxY}>
        <Stop offset="0" stopColor="#8fa3c2" stopOpacity="0" /><Stop offset="0.55" stopColor="#8fa3c2" stopOpacity="0.05" /><Stop offset="1" stopColor="#7d91b3" stopOpacity="0.55" />
      </LinearGradient>
      <ClipPath id={id('cc')}>{circles.map((q, i) => <Circle key={i} cx={q.x} cy={q.y} r={q.r} />)}</ClipPath>
    </Defs>
    {/* soft cast shadow on the hair and a cool rim light under the cloud */}
    <SoftShadow id={id} name="csh" cx={c.x} cy={a.top.y - 0.4} rx={0.95} ry={0.16} opacity={0.2} />
    <SoftShadow id={id} name="cgl" cx={c.x} cy={c.y} rx={1.4} ry={0.7} opacity={0.25} color="#ffffff" />
    {circles.map((q, i) => <Circle key={i} cx={q.x} cy={q.y} r={q.r} fill={`url(#${id('cp')})`} />)}
    <G clipPath={`url(#${id('cc')})`}><Rect x={c.x - 1.2} y={minY} width={2.4} height={maxY - minY} fill={`url(#${id('cu')})`} /></G>
    <SoftShadow id={id} name="ckl" cx={-0.68} cy={0.6} rx={0.28} ry={0.17} opacity={0.3} color="#ff6f9f" />
    <SoftShadow id={id} name="ckr" cx={0.68} cy={0.6} rx={0.28} ry={0.17} opacity={0.3} color="#ff6f9f" />
    {pour && <RainbowPour a={a} id={id} ageS={ageS} />}
  </G>;
}

const BANDS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#af52de'];
function RainbowPour({ a, id, ageS }: { a: LensAnchors; id: Id; ageS: number }) {
  const m = a.mouth, bw = Math.max(0.05, (a.mouthHalfW * 1.4) / BANDS.length);
  const L = 0.4 + Math.min(1, ageS / 0.35) * 2.3;
  return <G>
    <Defs>{BANDS.map((col, i) => <LinearGradient key={i} id={id(`rb${i}`)} gradientUnits="userSpaceOnUse" x1={m.x} y1={m.y} x2={m.x} y2={m.y + L}>
      <Stop offset="0" stopColor={col} stopOpacity="0.85" /><Stop offset="0.6" stopColor={col} stopOpacity="0.7" /><Stop offset="1" stopColor={col} stopOpacity="0" />
    </LinearGradient>)}</Defs>
    <SoftShadow id={id} name="rbg" cx={m.x} cy={m.y + 0.2} rx={0.9} ry={0.5} opacity={0.3} color="#ffffff" />
    {BANDS.map((_, i) => {
      const o = (i - (BANDS.length - 1) / 2) * bw;
      return <Path key={i} d={`M${n(m.x + o)} ${n(m.y)}C${n(m.x + o * 1.3)} ${n(m.y + L * 0.35)} ${n(m.x + o * 1.8 + 0.12)} ${n(m.y + L * 0.7)} ${n(m.x + o * 2.3 + 0.3)} ${n(m.y + L)}`}
        fill="none" stroke={`url(#${id(`rb${i}`)})`} strokeWidth={bw * 1.08} strokeLinecap="butt" />;
    })}
    <Path d={`M${n(m.x - bw * 2.6)} ${n(m.y)}C${n(m.x - bw * 3.3)} ${n(m.y + L * 0.35)} ${n(m.x - bw * 5.5 + 0.15)} ${n(m.y + L * 0.7)} ${n(m.x - bw * 7.5 + 0.35)} ${n(m.y + L)}`}
      fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={bw * 0.3} strokeLinecap="round" />
    <SoftShadow id={id} name="rbm" cx={m.x} cy={m.y} rx={a.mouthHalfW} ry={Math.max(0.06, a.mouthGap * 0.5)} opacity={0.5} color="#ffffff" />
  </G>;
}

function Blush({ a, id }: { a: LensAnchors; id: Id }) {
  const glints = [-1, 1].flatMap((s) => Array.from({ length: 7 }, (_, i) => ({ x: s * (0.6 + (rand(3, i, s + 2) - 0.5) * 0.36), y: 0.5 + (rand(5, i, s + 2) - 0.5) * 0.24, r: 0.008 + rand(9, i, s + 2) * 0.012, o: 0.35 + rand(11, i, s + 2) * 0.5 })));
  return <G>
    <SoftShadow id={id} name="bl" cx={-0.62} cy={0.55} rx={0.38} ry={0.27} opacity={0.5} color="#ff3f74" />
    <SoftShadow id={id} name="br" cx={0.62} cy={0.55} rx={0.38} ry={0.27} opacity={0.5} color="#ff3f74" />
    <SoftShadow id={id} name="bn" cx={a.nose.x} cy={a.nose.y + 0.02} rx={0.14} ry={0.09} opacity={0.22} color="#ff3f74" />
    <SoftShadow id={id} name="bhl" cx={-0.68} cy={0.38} rx={0.16} ry={0.06} opacity={0.22} color="#ffffff" />
    <SoftShadow id={id} name="bhr" cx={0.68} cy={0.38} rx={0.16} ry={0.06} opacity={0.22} color="#ffffff" />
    {glints.map((g, i) => <Circle key={i} cx={g.x} cy={g.y} r={g.r} fill="#ffffff" opacity={g.o} />)}
  </G>;
}

const STAR4 = (r: number) => `M0 ${n(-r)}Q${n(r * 0.12)} ${n(-r * 0.12)} ${n(r)} 0Q${n(r * 0.12)} ${n(r * 0.12)} 0 ${n(r)}Q${n(-r * 0.12)} ${n(r * 0.12)} ${n(-r)} 0Q${n(-r * 0.12)} ${n(-r * 0.12)} 0 ${n(-r)}Z`;
function Glint({ id, x, y, r, o = 1, color = '#ffffff' }: { id: Id; x: number; y: number; r: number; o?: number; color?: string }) {
  return <G transform={`translate(${n(x)} ${n(y)})`} opacity={o}>
    <Circle r={r * 0.9} fill={`url(#${id('glow')})`} />
    <Path d={STAR4(r)} fill={color} />
  </G>;
}
const GlowDef = ({ id, color = '#ffffff' }: { id: Id; color?: string }) => <Defs><RadialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
  <Stop offset="0" stopColor={color} stopOpacity="0.85" /><Stop offset="0.35" stopColor={color} stopOpacity="0.3" /><Stop offset="1" stopColor={color} stopOpacity="0" />
</RadialGradient></Defs>;

function StarEyes({ a, id }: { a: LensAnchors; id: Id }) {
  const lid = [-1, 1].flatMap((s) => Array.from({ length: 16 }, (_, i) => {
    const t = rand(21, i, s + 3), u = rand(23, i, s + 3);
    return { x: s * 0.5 + (t - 0.5) * 0.5, y: -0.17 - Math.sin(t * Math.PI) * 0.06 + (u - 0.5) * 0.08, r: 0.006 + rand(25, i, s + 3) * 0.014, gold: rand(27, i, s + 3) > 0.6, o: 0.45 + rand(29, i, s + 3) * 0.55 };
  }));
  return <G>
    <GlowDef id={id} />
    {[-1, 1].map((s) => <G key={s}>
      <SoftShadow id={id} name={`es${s}`} cx={s * 0.5} cy={-0.16} rx={0.3} ry={0.12} opacity={0.5} color="#a24dff" />
      <SoftShadow id={id} name={`ep${s}`} cx={s * 0.56} cy={-0.2} rx={0.16} ry={0.07} opacity={0.4} color="#ff7ad9" />
    </G>)}
    {lid.map((g, i) => <Circle key={i} cx={g.x} cy={g.y} r={g.r} fill={g.gold ? '#ffe28a' : '#ffffff'} opacity={g.o} />)}
    <Glint id={id} x={-0.78} y={-0.27} r={0.09} />
    <Glint id={id} x={0.8} y={-0.3} r={0.11} />
    <Glint id={id} x={0.3} y={-0.24} r={0.05} o={0.8} />
    {/* star-shaped catchlights in the irises */}
    <Glint id={id} x={-0.53} y={-0.04} r={0.05} o={0.9} />
    <Glint id={id} x={0.47} y={-0.04} r={0.05} o={0.9} />
  </G>;
}

/** Particles in view points, shaded: glossy hearts, glowing stars. */
function ShadedParticles({ items, id, glow }: { items: Particle[]; id: Id; glow?: boolean }) {
  return <G>
    <Defs><RadialGradient id={id('pg')} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#ffffff" stopOpacity="0.8" /><Stop offset="0.4" stopColor="#fff3b0" stopOpacity="0.25" /><Stop offset="1" stopColor="#fff3b0" stopOpacity="0" /></RadialGradient></Defs>
    {items.map((p, i) => <G key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rotDeg.toFixed(1)}) scale(${p.size.toFixed(2)})`} opacity={p.opacity}>
      {p.shape === 'heart' ? <>
        <Path d={HEART} fill={p.color} />
        <Path d="M-0.28 -0.3 C-0.4 -0.3 -0.42 -0.12 -0.3 -0.02" fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.07} strokeLinecap="round" />
        <Path d={HEART} fill="none" stroke="#7a0030" strokeOpacity={0.25} strokeWidth={0.03} />
      </> : <>
        {glow && <Circle r={1.1} fill={`url(#${id('pg')})`} />}
        <Path d={STAR4(0.55)} fill={p.color} />
      </>}
    </G>)}
  </G>;
}
const HEART = 'M0 0.35 C-0.55 -0.15 -0.3 -0.7 0 -0.32 C0.3 -0.7 0.55 -0.15 0 0.35 Z';

function HeartBurst({ a, id, ageS }: { a: LensAnchors; id: Id; ageS: number }) {
  const f = a.frame, d = f.eyeDist;
  const P = (x: number, y: number): Pt => ({ x: f.eyeMid.x + (f.ux.x * x + f.uy.x * y) * d, y: f.eyeMid.y + (f.ux.y * x + f.uy.y * y) * d });
  const pink = ['#ff2d6f', '#ff7aa8', '#ff4f8a'];
  return <ShadedParticles id={id} items={[...burstParticles(P(-0.75, 0.55), ageS % 0.9, d, 3, 'heart', pink, 8), ...burstParticles(P(0.75, 0.55), (ageS + 0.45) % 0.9, d, 5, 'heart', pink, 8)]} />;
}
function StarBurst({ a, id, ageS }: { a: LensAnchors; id: Id; ageS: number }) {
  const f = a.frame, d = f.eyeDist;
  return <ShadedParticles id={id} glow items={[...burstParticles(f.eyeL, ageS, d, 11, 'star', ['#ffffff', '#fff2a8', '#ffd84d']), ...burstParticles(f.eyeR, ageS, d, 13, 'star', ['#ffffff', '#fff2a8', '#ffd84d'])]} />;
}

function Clown({ a, id }: { a: LensAnchors; id: Id }) {
  const nose = a.nose, nr = 0.21;
  // Curly wig: many small shaded curls in a puffy cluster at each temple, drawn back to front.
  const tufts = [-1, 1].flatMap((s) => {
    const hw = (s < 0 ? a.halfWL : a.halfWR), cx = s * (hw + 0.12), cy = -0.55;
    return Array.from({ length: 46 }, (_, i) => {
      const t = rand(41, i, s + 2) * Math.PI * 2, u = Math.sqrt(rand(43, i, s + 2));
      return { x: cx + Math.cos(t) * u * 0.36 + s * 0.05, y: cy + Math.sin(t) * u * 0.58, r: 0.085 + rand(47, i, s + 2) * 0.07, depth: Math.cos(t) * s, s };
    });
  }).sort((p, q) => p.depth - q.depth);
  const lips = a.lipsOuter.length >= 6 ? a.lipsOuter : null;
  const mc = a.mouth;
  const outer = lips ? smoothClosedPath(scaleAbout(lips, mc, 1.16, 1.3)) : `M${n(mc.x - 0.5)} ${n(mc.y)}Q${n(mc.x)} ${n(mc.y + 0.32)} ${n(mc.x + 0.5)} ${n(mc.y)}Q${n(mc.x)} ${n(mc.y + 0.12)} ${n(mc.x - 0.5)} ${n(mc.y)}Z`;
  const inner = a.lipsInner.length >= 6 && a.mouthGap > 0.06 ? smoothClosedPath(scaleAbout(a.lipsInner, mc, 0.95)) : '';
  const diamond = (x: number, y0: number, y1: number, w: number) => `M${n(x)} ${n(y0)}L${n(x + w)} ${n((y0 + y1) / 2)}L${n(x)} ${n(y1)}L${n(x - w)} ${n((y0 + y1) / 2)}Z`;
  return <G>
    <Defs>
      <RadialGradient id={id('tuft')} cx="50%" cy="50%" r="50%" fx="38%" fy="32%">
        <Stop offset="0" stopColor="#ffc06a" /><Stop offset="0.5" stopColor="#f57a10" /><Stop offset="0.9" stopColor="#b9480a" /><Stop offset="1" stopColor="#7a2c00" stopOpacity="0.6" />
      </RadialGradient>
      <RadialGradient id={id('nose')} cx="50%" cy="50%" r="50%" fx="36%" fy="30%">
        <Stop offset="0" stopColor="#ff8a8a" /><Stop offset="0.35" stopColor="#f0142c" /><Stop offset="0.85" stopColor="#a8000f" /><Stop offset="1" stopColor="#5e0008" />
      </RadialGradient>
      <LinearGradient id={id('paint')} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#2a55ff" stopOpacity="0.05" /><Stop offset="0.5" stopColor="#2a55ff" stopOpacity="0.5" /><Stop offset="1" stopColor="#2a55ff" stopOpacity="0.05" />
      </LinearGradient>
    </Defs>
    {/* white greasepaint around the mouth, blended into the skin */}
    <SoftShadow id={id} name="cm" cx={mc.x} cy={mc.y + 0.02} rx={Math.max(0.55, a.mouthHalfW * 1.55)} ry={0.4 + a.mouthGap * 0.5} opacity={0.5} color="#fffaf2" />
    {[-1, 1].map((s) => <G key={s}>
      <Path d={diamond(s * 0.5, -0.56, -0.12, 0.1)} fill={`url(#${id('paint')})`} />
      <Path d={diamond(s * 0.5, 0.1, 0.46, 0.09)} fill={`url(#${id('paint')})`} />
    </G>)}
    <Path d={inner ? `${outer} ${inner}` : outer} fill="#d10f28" fillOpacity={0.7} fillRule="evenodd" />
    <SoftShadow id={id} name="clg" cx={mc.x - 0.05} cy={mc.y + a.mouthGap / 2 + 0.06} rx={a.mouthHalfW * 0.45} ry={0.035} opacity={0.35} color="#ffffff" />
    {[-1, 1].map((sd) => <SoftShadow key={`ws${sd}`} id={id} name={`cws${sd}`} cx={sd * ((sd < 0 ? a.halfWL : a.halfWR) + 0.05)} cy={-0.5} rx={0.45} ry={0.7} opacity={0.3} />)}
    {tufts.map((t, i) => <G key={i}>
      <Circle cx={t.x} cy={t.y} r={t.r} fill={`url(#${id('tuft')})`} />
      <Path d={`M${n(t.x - t.r * 0.55)} ${n(t.y + t.r * 0.15)}Q${n(t.x - t.r * 0.1)} ${n(t.y - t.r * 0.7)} ${n(t.x + t.r * 0.5)} ${n(t.y - t.r * 0.05)}`} fill="none" stroke="#6e2600" strokeOpacity={0.4} strokeWidth={t.r * 0.16} strokeLinecap="round" />
    </G>)}
    <SoftShadow id={id} name="cns" cx={nose.x + 0.02} cy={nose.y + nr * 0.85} rx={nr * 1.1} ry={nr * 0.45} opacity={0.5} />
    <Circle cx={nose.x} cy={nose.y} r={nr} fill={`url(#${id('nose')})`} />
    <Ellipse cx={nose.x - nr * 0.33} cy={nose.y - nr * 0.38} rx={nr * 0.28} ry={nr * 0.18} fill="#ffffff" opacity={0.6} transform={`rotate(-30 ${n(nose.x - nr * 0.33)} ${n(nose.y - nr * 0.38)})`} />
    <Circle cx={nose.x - nr * 0.38} cy={nose.y - nr * 0.42} r={nr * 0.07} fill="#ffffff" opacity={0.9} />
  </G>;
}

function Halo({ a, id }: { a: LensAnchors; id: Id }) {
  const c = { x: a.top.x, y: a.top.y - 0.95 }, rx = 0.72, ry = 0.16;
  const front = `M${n(c.x - rx)} ${n(c.y)}A${n(rx)} ${n(ry)} 0 0 0 ${n(c.x + rx)} ${n(c.y)}`;
  return <G>
    <Defs><LinearGradient id={id('hg')} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#c48a17" /><Stop offset="0.25" stopColor="#ffe07a" /><Stop offset="0.5" stopColor="#fff8dc" /><Stop offset="0.75" stopColor="#ffe07a" /><Stop offset="1" stopColor="#c48a17" />
    </LinearGradient></Defs>
    <SoftShadow id={id} name="hl" cx={c.x} cy={a.top.y - 0.45} rx={1.05} ry={0.5} opacity={0.25} color="#fff3c4" />
    <Ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill="none" stroke="#fff0a8" strokeOpacity={0.12} strokeWidth={0.34} />
    <Ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill="none" stroke="#fff0a8" strokeOpacity={0.22} strokeWidth={0.2} />
    <Ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill="none" stroke={`url(#${id('hg')})`} strokeWidth={0.085} />
    <Path d={front} fill="none" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={0.025} strokeLinecap="round" />
  </G>;
}

const FEATHERS = wingFeathers();
/** One feathered wing (view points), root on the shoulder, mirrored for the image-left side. */
function Wing({ w, id }: { w: WingLayout; id: Id }) {
  // Back row first (long primaries), outer feathers under inner ones, coverts on top.
  const order = [...FEATHERS].sort((p, q) => p.row - q.row || q.base.x - p.base.x);
  const body = FEATHERS.filter((f) => f.row === 0);
  const tipOf = (f: (typeof FEATHERS)[number]) => { const r = (f.angDeg * Math.PI) / 180; return { x: f.base.x + Math.cos(r) * f.len * 0.9, y: f.base.y + Math.sin(r) * f.len * 0.9 }; };
  const silhouette = [{ x: 0, y: 0 }, ...body.map((f) => f.base), ...[...body].reverse().map(tipOf)];
  const tr = `translate(${n(w.root.x)} ${n(w.root.y)}) rotate(${n(w.rotDeg)}) scale(${n(w.side * w.scale)} ${n(w.scale)})`;
  return <G transform={tr}>
    <Defs>
      <LinearGradient id={id('wf0')} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#d6dde8" /><Stop offset="0.5" stopColor="#f7f9fc" /><Stop offset="0.92" stopColor="#ffffff" /><Stop offset="1" stopColor="#cfd8e5" />
      </LinearGradient>
      <LinearGradient id={id('wf1')} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#e6ebf2" /><Stop offset="0.6" stopColor="#ffffff" /><Stop offset="1" stopColor="#dde4ee" />
      </LinearGradient>
      <LinearGradient id={id(`wb${w.side}`)} gradientUnits="userSpaceOnUse" x1="0" y1="-2.5" x2="1.6" y2="0.5">
        <Stop offset="0" stopColor="#ffffff" /><Stop offset="1" stopColor="#c3cddc" />
      </LinearGradient>
    </Defs>
    <SoftShadow id={id} name={`ws${w.side}`} cx={0.9} cy={-1.0} rx={1.6} ry={1.9} opacity={0.16} />
    <Path d={smoothClosedPath(silhouette)} fill={`url(#${id(`wb${w.side}`)})`} opacity={0.9} />
    {order.map((f, i) => {
      const L = f.len, wd = f.width;
      const d = `M0 0C${n(L * 0.25)} ${n(-wd * 0.55)} ${n(L * 0.8)} ${n(-wd * 0.6)} ${n(L)} 0C${n(L * 0.8)} ${n(wd * 0.6)} ${n(L * 0.25)} ${n(wd * 0.55)} 0 0Z`;
      return <G key={i} transform={`translate(${n(f.base.x)} ${n(f.base.y)}) rotate(${n(f.angDeg)})`}>
        <Path d={d} fill={`url(#${id(f.row ? 'wf1' : 'wf0')})`} />
        <Path d={`M${n(L * 0.03)} 0Q${n(L * 0.5)} ${n(wd * 0.06)} ${n(L * 0.94)} 0`} fill="none" stroke="#aab6c9" strokeOpacity={0.4} strokeWidth={0.012} />
        <Path d={d} fill="none" stroke="#8f9db4" strokeOpacity={0.28} strokeWidth={0.01} />
      </G>;
    })}
    {/* shade where the wing disappears behind the shoulder */}
    <SoftShadow id={id} name={`wr${w.side}`} cx={0.1} cy={0} rx={0.55} ry={0.4} opacity={0.3} />
  </G>;
}
