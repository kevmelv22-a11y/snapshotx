import { centroid, faceFrame, lipPoints, polygonRadius, type FaceFrame, type Size } from './geometry';
import type { FaceGeometry, Pt } from './types';

/**
 * Stable anchor points for lens artwork, in a face-local frame: origin = eye midpoint, x along the
 * eye line, y towards the chin, unit = eye distance. Head-attached art (horns, halo, wig, cloud)
 * only uses points that do NOT move when the mouth opens (eyes, upper face oval, nose), so it never
 * stretches with the jaw. Mouth-attached art (fire, rainbow, clown lips) uses `mouth` separately.
 */
export type LensAnchors = {
  frame: FaceFrame;
  /** SVG matrix(a b c d e f) mapping local (eye-distance) units to view points. */
  matrix: [number, number, number, number, number, number];
  /** Top of the face oval (forehead / hairline) and the oval half-widths at eye level. */
  top: Pt; halfWL: number; halfWR: number;
  /** Nose tip estimate; its x shows where the face midline is when the head is turned (yaw). */
  nose: Pt;
  /** Mouth: centre of the lips, half width, inner-lip gap (all local units). Moves with the jaw. */
  mouth: Pt; mouthHalfW: number; mouthGap: number;
  /** Outer / inner lip polygons in local units (empty when the detector gives no lip contours). */
  lipsOuter: Pt[]; lipsInner: Pt[];
};

const finite = (p?: Pt): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

export function toLocalFn(f: FaceFrame) {
  return (p: Pt): Pt => { const dx = p.x - f.eyeMid.x, dy = p.y - f.eyeMid.y; return { x: (dx * f.ux.x + dy * f.ux.y) / f.eyeDist, y: (dx * f.uy.x + dy * f.uy.y) / f.eyeDist }; };
}
export function fromLocalFn(f: FaceFrame) {
  return (q: Pt): Pt => ({ x: f.eyeMid.x + (f.ux.x * q.x + f.uy.x * q.y) * f.eyeDist, y: f.eyeMid.y + (f.ux.y * q.x + f.uy.y * q.y) * f.eyeDist });
}

export function lensAnchors(face: FaceGeometry): LensAnchors {
  const f = faceFrame(face);
  const L = toLocalFn(f);
  const d = f.eyeDist;
  const matrix: LensAnchors['matrix'] = [f.ux.x * d, f.ux.y * d, f.uy.x * d, f.uy.y * d, f.eyeMid.x, f.eyeMid.y];
  const oval = face.contours?.FACE?.filter(finite).map(L);
  let topY = -1.25, halfWL = 0.98, halfWR = 0.98, topX = 0;
  if (oval && oval.length >= 8) {
    // Only the upper half of the oval: the chin part moves with the jaw.
    const r = (t: number) => polygonRadius(oval, t);
    const up = r(-Math.PI / 2); if (up > 0.6 && up < 3) topY = -up;
    const a = r(Math.PI), b = r(0); if (a > 0.5 && a < 2.5) halfWL = a; if (b > 0.5 && b < 2.5) halfWR = b;
    const upper = oval.filter((p) => p.y < topY * 0.6);
    if (upper.length >= 2) topX = upper.reduce((s, p) => s + p.x, 0) / upper.length;
  }
  const c = face.contours ?? {};
  const lm = face.landmarks ?? {};
  let nose: Pt = { x: topX * 0.5, y: 0.6 };
  const nb = c.NOSE_BOTTOM?.filter(finite);
  if (nb && nb.length) { const n = L(centroid(nb)); nose = { x: n.x, y: n.y - 0.1 }; }
  else if (finite(lm.NOSE_BASE)) { const n = L(lm.NOSE_BASE); nose = { x: n.x, y: n.y - 0.1 }; }
  const lipsOuter = [...(c.UPPER_LIP_TOP ?? []), ...[...(c.LOWER_LIP_BOTTOM ?? [])].reverse()].filter(finite).map(L);
  const lipsInner = [...(c.UPPER_LIP_BOTTOM ?? []), ...[...(c.LOWER_LIP_TOP ?? [])].reverse()].filter(finite).map(L);
  const lips = lipPoints(face).map(L);
  let mouth = L(f.mouth), mouthHalfW = 0.42, mouthGap = 0;
  if (lips.length >= 4) {
    const xs = lips.map((p) => p.x);
    mouthHalfW = (Math.max(...xs) - Math.min(...xs)) / 2;
  } else if (finite(lm.MOUTH_LEFT) && finite(lm.MOUTH_RIGHT)) mouthHalfW = Math.abs(L(lm.MOUTH_RIGHT).x - L(lm.MOUTH_LEFT).x) / 2;
  const up = c.UPPER_LIP_BOTTOM?.filter(finite).map(L), low = c.LOWER_LIP_TOP?.filter(finite).map(L);
  if (up && low && up.length >= 3 && low.length >= 3) {
    const mid = (pts: Pt[]) => { const s = [...pts].sort((a, b) => a.x - b.x); const k = Math.floor(s.length / 3); return centroid(s.slice(k, s.length - k)); };
    const a = mid(up), b = mid(low);
    mouthGap = Math.max(0, b.y - a.y);
    mouth = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { frame: f, matrix, top: { x: topX, y: topY }, halfWL, halfWR, nose, mouth, mouthHalfW, mouthGap, lipsOuter, lipsInner };
}

export type WingLayout = {
  /** Wing root (top of the shoulder, beside the neck) in view points, per image side. */
  root: Pt;
  /** Wing size in view points per wing unit (see wingFeathers for the art extents). */
  scale: number;
  /** -1 = wing extends to image-left, +1 = image-right. */
  side: -1 | 1;
  /** Head roll in degrees (the wings follow the shoulders). */
  rotDeg: number;
};

/** One feather: attached at `base`, pointing along `angDeg` (0 = outwards, 90 = down), wing units. */
export type Feather = { base: Pt; angDeg: number; len: number; width: number; row: number };

/**
 * Angel wing geometry in wing units, for the image-right wing (x outwards, y down; root = 0,0):
 * an arm curves up and out from the shoulder, rows of feathers hang down-outwards from it
 * (long primaries at the back, shorter coverts in front). Shared by the renderer and the layout.
 */
export function wingFeathers(): Feather[] {
  const arm = (t: number): Pt => { const u = 1 - t; return { x: 2 * u * t * 0.25 + t * t * 1.25, y: 2 * u * t * -1.9 + t * t * -2.45 }; };
  const out: Feather[] = [];
  const rows = [{ n: 12, len: [0.9, 2.0], width: 0.24, t0: 0.18 }, { n: 10, len: [0.6, 1.25], width: 0.22, t0: 0.12 }, { n: 8, len: [0.35, 0.6], width: 0.19, t0: 0.06 }];
  rows.forEach((r, row) => {
    for (let i = 0; i < r.n; i++) {
      const t = r.t0 + (i / (r.n - 1)) * (1 - r.t0);
      out.push({ base: arm(t), angDeg: 102 - t * 42, len: r.len[0] + (r.len[1] - r.len[0]) * t * t, width: r.width, row });
    }
  });
  return out;
}

/** Bounding extents of the wing art (wing units) relative to the root. */
export function wingExtent() {
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const f of wingFeathers()) {
    const a = (f.angDeg * Math.PI) / 180;
    for (const p of [f.base, { x: f.base.x + Math.cos(a) * f.len, y: f.base.y + Math.sin(a) * f.len }]) {
      minX = Math.min(minX, p.x - f.width); maxX = Math.max(maxX, p.x + f.width); minY = Math.min(minY, p.y - f.width); maxY = Math.max(maxY, p.y + f.width);
    }
  }
  return { minX, maxX, minY, maxY };
}
export const WING_EXTENT = (() => { const e = wingExtent(); return { out: e.maxX, up: -e.minY, down: e.maxY }; })();

/**
 * Angel wings behind the shoulders, kept inside the view. At normal distance they are ~1.25 eye
 * distances per wing unit; on a close-up selfie (face fills the screen) they shrink (down to 35%)
 * and, if needed, the root slides in towards the neck, so the wing stays on screen instead of being
 * cut off at the edge.
 */
/** All feather base/tip points of a laid-out wing, in view points (for fitting and tests). */
export function wingPoints(w: WingLayout): Pt[] {
  const r = (w.rotDeg * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  const T = (p: Pt): Pt => { const x = p.x * w.side * w.scale, y = p.y * w.scale; return { x: w.root.x + x * c - y * sn, y: w.root.y + x * sn + y * c }; };
  const out: Pt[] = [];
  for (const f of wingFeathers()) {
    const a = (f.angDeg * Math.PI) / 180;
    out.push(T(f.base), T({ x: f.base.x + Math.cos(a) * f.len, y: f.base.y + Math.sin(a) * f.len }));
  }
  return out;
}

/**
 * Angel wings behind the shoulders, kept inside the view. At normal distance they rise from the
 * shoulders at ~1.3 eye distances per wing unit; when that does not fit, they shrink (to 60%)
 * and slide in towards the neck. On a close-up selfie (no room beside the shoulders) smaller wings
 * peek out from behind the head at the temples, at least 80% on screen.
 */
export function wingLayout(face: FaceGeometry, view: Size): [WingLayout, WingLayout] {
  const a = lensAnchors(face);
  const f = a.frame, d = f.eyeDist;
  const P = fromLocalFn(f);
  const margin = Math.min(view.width, view.height) * 0.02;
  const roll = (f.roll * 180) / Math.PI;
  const fits = (w: WingLayout) => wingPoints(w).every((p) => p.x >= margin && p.x <= view.width - margin && p.y >= margin && p.y <= view.height * 1.08);
  const make = (side: -1 | 1): WingLayout => {
    const halfW = side < 0 ? a.halfWL : a.halfWR;
    let rootX = side * (halfW * 0.95);
    const rootY = 2.45;
    const at = (sc: number): WingLayout => ({ root: P({ x: rootX, y: rootY }), scale: sc * d, side, rotDeg: roll - side * 8 });
    let s = 1.35;
    while (!fits(at(s)) && s > 0.6) s -= 0.025;
    for (let k = 0; k < 12 && !fits(at(s)); k++) rootX -= side * 0.04;
    if (fits(at(s))) return at(s);
    // Close-up (no room beside the shoulders): smaller wings peek out from behind the upper head
    // and spread up/out into the hair/background; allowed to be trimmed a little by the
    // screen edge (>= 80% of the feathers stay visible), never pushed off-screen.
    const inside = (w: WingLayout) => { const q = wingPoints(w); return q.filter((p) => p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height).length / q.length; };
    const temple = (sc: number): WingLayout => ({ root: P({ x: side * halfW * 0.85, y: -0.9 }), scale: sc * d, side, rotDeg: roll - side * 38 });
    let t = 1.0;
    while (inside(temple(t)) < 0.8 && t > 0.3) t -= 0.025;
    return temple(t);
  };
  return [make(-1), make(1)];
}
