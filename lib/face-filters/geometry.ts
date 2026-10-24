import type { FaceGeometry, FaceRect, Pt } from './types';

export type Size = { width: number; height: number };

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);
const finite = (p?: Pt): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

export function centroid(points: Pt[]): Pt {
  if (!points.length) throw new Error('centroid of empty point list');
  const s = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return mul(s, 1 / points.length);
}

const usable = (pts?: Pt[], min = 3): pts is Pt[] => !!pts && pts.filter(finite).length >= min;

/** Applies `fn` to every point of a face (bounds are recomputed from the mapped corners). */
export function mapFaceGeometry(face: FaceGeometry, fn: (p: Pt) => Pt): FaceGeometry {
  const b = face.bounds;
  const corners = [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height }].map(fn);
  const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
  const bounds: FaceRect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  const contours: FaceGeometry['contours'] = {};
  for (const [k, pts] of Object.entries(face.contours ?? {})) if (pts) contours[k as keyof typeof contours] = pts.filter(finite).map(fn);
  const landmarks: FaceGeometry['landmarks'] = {};
  for (const [k, p] of Object.entries(face.landmarks ?? {})) if (finite(p)) landmarks[k as keyof typeof landmarks] = fn(p);
  return { ...face, bounds, contours, landmarks };
}

/** Image-pixel -> view-point mapping for an image shown with resizeMode="cover" (centered crop). */
export function coverTransform(image: Size, view: Size, mirrored = false): (p: Pt) => Pt {
  if (image.width <= 0 || image.height <= 0 || view.width <= 0 || view.height <= 0) throw new Error('Image and view dimensions must be positive.');
  const scale = Math.max(view.width / image.width, view.height / image.height);
  const cropX = (image.width * scale - view.width) / 2;
  const cropY = (image.height * scale - view.height) / 2;
  return (p) => {
    const x = p.x * scale - cropX;
    return { x: mirrored ? view.width - x : x, y: p.y * scale - cropY };
  };
}

export type FaceFrame = {
  /** Eye centres, ordered left/right as they appear in the image. */
  eyeL: Pt; eyeR: Pt; eyeMid: Pt; mouth: Pt;
  /** Unit vectors: ux along the eye line (image left -> right), uy perpendicular, pointing to the chin. */
  ux: Pt; uy: Pt;
  eyeDist: number; eyeToMouth: number;
  /** Head roll in radians (0 = upright, positive = clockwise on screen). */
  roll: number;
  center: Pt;
};

function eyeCenter(face: FaceGeometry, which: 'LEFT_EYE' | 'RIGHT_EYE'): Pt | undefined {
  const c = face.contours?.[which];
  if (usable(c, 4)) return centroid(c.filter(finite));
  const l = face.landmarks?.[which];
  return finite(l) ? l : undefined;
}

export function lipPoints(face: FaceGeometry): Pt[] {
  const c = face.contours ?? {};
  return [...(c.UPPER_LIP_TOP ?? []), ...(c.LOWER_LIP_BOTTOM ?? [])].filter(finite);
}

/** Face coordinate frame from eyes + mouth, with graceful fallbacks to landmarks and then bounds. */
export function faceFrame(face: FaceGeometry): FaceFrame {
  const b = face.bounds;
  let a = eyeCenter(face, 'LEFT_EYE');
  let c = eyeCenter(face, 'RIGHT_EYE');
  if (!a || !c) {
    a = { x: b.x + b.width * 0.31, y: b.y + b.height * 0.38 };
    c = { x: b.x + b.width * 0.69, y: b.y + b.height * 0.38 };
  }
  const [eyeL, eyeR] = a.x <= c.x ? [a, c] : [c, a];
  const eyeVec = sub(eyeR, eyeL);
  const eyeDist = Math.max(1e-3, len(eyeVec));
  const ux = mul(eyeVec, 1 / eyeDist);
  const uy = { x: -ux.y, y: ux.x };
  const eyeMid = mul(add(eyeL, eyeR), 0.5);
  const lips = lipPoints(face);
  const lm = face.landmarks ?? {};
  let mouth: Pt;
  if (lips.length >= 4) mouth = centroid(lips);
  else if (finite(lm.MOUTH_LEFT) && finite(lm.MOUTH_RIGHT)) {
    const corners = mul(add(lm.MOUTH_LEFT, lm.MOUTH_RIGHT), 0.5);
    mouth = finite(lm.MOUTH_BOTTOM) ? add(mul(corners, 0.7), mul(lm.MOUTH_BOTTOM, 0.3)) : corners;
  } else mouth = add(eyeMid, mul(uy, eyeDist * 1.05));
  // Keep the mouth on the chin side of the eye line and at a plausible distance.
  const eyeToMouth = Math.min(1.8 * eyeDist, Math.max(0.6 * eyeDist, dot(sub(mouth, eyeMid), uy)));
  const oval = face.contours?.FACE;
  const center = usable(oval, 8) ? centroid(oval.filter(finite)) : add(eyeMid, mul(uy, eyeToMouth * 0.45));
  return { eyeL, eyeR, eyeMid, mouth, ux, uy, eyeDist, eyeToMouth, roll: Math.atan2(ux.y, ux.x), center };
}

const toLocal = (p: Pt, o: Pt, f: FaceFrame): Pt => { const d = sub(p, o); return { x: dot(d, f.ux), y: dot(d, f.uy) }; };
const fromLocal = (q: Pt, o: Pt, f: FaceFrame): Pt => add(o, add(mul(f.ux, q.x), mul(f.uy, q.y)));

/** Distance from the origin to a star-shaped polygon (local coords) along angle `theta`. */
export function polygonRadius(local: Pt[], theta: number): number {
  const sorted = [...local].sort((p, q) => Math.atan2(p.y, p.x) - Math.atan2(q.y, q.x));
  const d = { x: Math.cos(theta), y: Math.sin(theta) };
  let best = 0;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i], q = sorted[(i + 1) % sorted.length];
    const e = sub(q, p);
    const den = d.x * e.y - d.y * e.x;
    if (Math.abs(den) < 1e-9) continue;
    const t = (p.x * e.y - p.y * e.x) / den; // distance along ray
    const s = (p.x * d.y - p.y * d.x) / den; // position along edge
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}

/** Closed Catmull-Rom spline through the points, as an SVG path (smooth, no corners). */
export function smoothClosedPath(points: Pt[], tension = 1): string {
  const n = points.length;
  if (n < 3) return '';
  const f = (v: number) => (Math.round(v * 10) / 10).toString();
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    const c1 = add(p1, mul(sub(p2, p0), tension / 6));
    const c2 = sub(p2, mul(sub(p3, p1), tension / 6));
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
}

function ellipsePoints(c: Pt, a: number, b: number, f: FaceFrame, n = 28, reverse = false): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((reverse ? -i : i) / n) * Math.PI * 2;
    pts.push(fromLocal({ x: a * Math.cos(t), y: b * Math.sin(t) }, c, f));
  }
  return pts;
}

function extents(points: Pt[], c: Pt, f: FaceFrame) {
  const local = points.map((p) => toLocal(p, c, f));
  const us = local.map((p) => p.x), vs = local.map((p) => p.y);
  return { halfW: (Math.max(...us) - Math.min(...us)) / 2, halfH: (Math.max(...vs) - Math.min(...vs)) / 2 };
}

export type Hole = { center: Pt; rx: number; ry: number; points: Pt[] };
export type BalaclavaShape = {
  frame: FaceFrame;
  outline: Pt[];
  eyes: [Hole, Hole];
  mouth: Hole;
  /** Path with the head outline + three holes; render with fillRule="evenodd". */
  d: string;
  outlineD: string;
  /** Knit stitch width in view units, scaled with the face. */
  stitch: number;
};

/**
 * Balaclava geometry from face contours: the face oval is grown into a full head (skull on top,
 * a little past the cheeks) and unioned with a neck tube; eye and mouth holes are fitted to the
 * eye and lip contours. Works in any frame where x/y share units (image pixels or view points).
 */
export function balaclavaShape(face: FaceGeometry): BalaclavaShape {
  const f = faceFrame(face);
  const d = f.eyeDist;
  const o = f.center;
  const ovalPts = face.contours?.FACE?.filter(finite);
  const ovalLocal = usable(ovalPts, 8) ? ovalPts.map((p) => toLocal(p, o, f)) : null;
  // Typical proportions when no FACE contour is available (bounds/landmarks only).
  const fallbackA = 1.1 * d, fallbackB = 0.75 * f.eyeToMouth + 0.6 * d;
  const ovalR = (t: number) => {
    if (ovalLocal) { const r = polygonRadius(ovalLocal, t); if (r > 0) return r; }
    return (fallbackA * fallbackB) / Math.hypot(fallbackB * Math.cos(t), fallbackA * Math.sin(t));
  };
  const chin = ovalR(Math.PI / 2);
  const halfWidth = (ovalR(0) + ovalR(Math.PI)) / 2;
  // Neck tube: superellipse below the chin.
  const nc = { x: 0, y: chin * 0.62 }, nw = halfWidth * 0.8, nh = chin * 0.92, ne = 4;
  const neckR = (t: number) => {
    const dir = { x: Math.cos(t), y: Math.sin(t) };
    const inside = (r: number) => Math.abs((r * dir.x - nc.x) / nw) ** ne + Math.abs((r * dir.y - nc.y) / nh) ** ne <= 1;
    if (!inside(0)) return 0;
    let lo = 0, hi = 4 * (chin + halfWidth);
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (inside(mid)) lo = mid; else hi = mid; }
    return lo;
  };
  const outline: Pt[] = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t = -Math.PI + (i / N) * Math.PI * 2;
    const s = Math.sin(t); // -1 = top of head, +1 = chin
    // Grow the oval: skull/hair on top, a bit past the cheekbones, just under the chin.
    const k = 1.1 + (s < 0 ? 0.5 * s * s : -0.03 * s * s);
    const r = Math.max(ovalR(t) * k, neckR(t));
    outline.push(fromLocal({ x: r * Math.cos(t), y: r * s }, o, f));
  }
  const eyeHole = (which: 'LEFT_EYE' | 'RIGHT_EYE', fallback: Pt): Hole => {
    const pts = face.contours?.[which]?.filter(finite);
    const c = usable(pts, 4) ? centroid(pts) : (finite(face.landmarks?.[which]) ? face.landmarks![which]! : fallback);
    const ext = usable(pts, 4) ? extents(pts, c, f) : { halfW: 0.24 * d, halfH: 0.08 * d };
    const rx = Math.max(ext.halfW * 1.7, 0.32 * d);
    const ry = Math.max(ext.halfH * 2.6, rx * 0.6, 0.17 * d);
    const center = add(c, mul(f.uy, -0.03 * d));
    return { center, rx, ry, points: ellipsePoints(center, rx, ry, f, 28, true) };
  };
  // Map detector LEFT/RIGHT (subject's side) onto image-left/right holes via the frame.
  const e1 = eyeHole('LEFT_EYE', f.eyeR), e2 = eyeHole('RIGHT_EYE', f.eyeL);
  const eyes: [Hole, Hole] = e1.center.x <= e2.center.x ? [e1, e2] : [e2, e1];
  const lips = lipPoints(face);
  let mouthHole: Hole;
  {
    const lm = face.landmarks ?? {};
    const c = f.mouth;
    let halfW: number, halfH: number;
    if (lips.length >= 4) ({ halfW, halfH } = extents(lips, c, f));
    else if (finite(lm.MOUTH_LEFT) && finite(lm.MOUTH_RIGHT)) { halfW = len(sub(lm.MOUTH_RIGHT, lm.MOUTH_LEFT)) / 2; halfH = halfW * 0.38; }
    else { halfW = 0.42 * d; halfH = 0.15 * d; }
    const rx = halfW * 1.22 + 0.04 * d;
    const ry = Math.max(halfH * 1.45, rx * 0.42);
    mouthHole = { center: c, rx, ry, points: ellipsePoints(c, rx, ry, f, 28, true) };
  }
  const outlineD = smoothClosedPath(outline);
  const pathD = [outlineD, ...eyes.map((h) => smoothClosedPath(h.points)), smoothClosedPath(mouthHole.points)].join(' ');
  return { frame: f, outline, eyes, mouth: mouthHole, d: pathD, outlineD, stitch: d / 9.5 };
}

/** Affine matrix [a,b,c,d,e,f] (SVG `matrix()` order) mapping three source points onto three targets. */
export function affineFromTriangles(src: [Pt, Pt, Pt], dst: [Pt, Pt, Pt]): [number, number, number, number, number, number] {
  const [p0, p1, p2] = src, [q0, q1, q2] = dst;
  const det = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
  if (Math.abs(det) < 1e-9) throw new Error('Degenerate source triangle');
  const solve = (v0: number, v1: number, v2: number) => {
    const a = ((v1 - v0) * (p2.y - p0.y) - (v2 - v0) * (p1.y - p0.y)) / det;
    const c = ((p1.x - p0.x) * (v2 - v0) - (p2.x - p0.x) * (v1 - v0)) / det;
    return { a, c, e: v0 - a * p0.x - c * p0.y };
  };
  const X = solve(q0.x, q1.x, q2.x), Y = solve(q0.y, q1.y, q2.y);
  return [X.a, Y.a, X.c, Y.c, X.e, Y.e];
}

/** Places sticker artwork (designed around `anchors` = left eye, right eye, mouth) onto the face (eye-anchored, no stretch). */
export function stickerMatrix(face: FaceGeometry, anchors: [Pt, Pt, Pt]) {
  // Similarity transform from the eyes only: the third anchor keeps the artwork's own
  // eye-to-mouth proportion instead of following the lips, so nothing stretches when the mouth opens.
  const f = faceFrame(face);
  const [a0, a1, a2] = anchors;
  const ad = Math.hypot(a1.x - a0.x, a1.y - a0.y);
  const amid = { x: (a0.x + a1.x) / 2, y: (a0.y + a1.y) / 2 };
  const ratio = Math.hypot(a2.x - amid.x, a2.y - amid.y) / Math.max(1e-6, ad);
  return affineFromTriangles(anchors, [f.eyeL, f.eyeR, add(f.eyeMid, mul(f.uy, f.eyeDist * ratio))]);
}

/** Synthetic, neutral placeholder face for previews (lens tiles); geometry in the given box. */
export function placeholderFace(w: number, h: number): { face: FaceGeometry; head: { cx: number; cy: number; rx: number; ry: number } } {
  const cx = w / 2, cy = h * 0.45, rx = w * 0.27, ry = rx * 1.32;
  const ring = (x: number, y: number, a: number, b: number, n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => { const t = -Math.PI / 2 + (i / n) * Math.PI * 2; return { x: x + a * Math.cos(t), y: y + b * Math.sin(t) }; });
  const eyeY = cy - ry * 0.05, eyeDx = rx * 0.43, eyeA = rx * 0.2, eyeB = rx * 0.085;
  const mouthY = cy + ry * 0.48, mouthA = rx * 0.32, mouthB = rx * 0.1;
  const face: FaceGeometry = {
    bounds: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
    contours: {
      FACE: ring(cx, cy + ry * 0.04, rx, ry * 0.94, 36),
      RIGHT_EYE: ring(cx - eyeDx, eyeY, eyeA, eyeB, 16),
      LEFT_EYE: ring(cx + eyeDx, eyeY, eyeA, eyeB, 16),
      UPPER_LIP_TOP: ring(cx, mouthY, mouthA, mouthB, 20).filter((p) => p.y <= mouthY),
      LOWER_LIP_BOTTOM: ring(cx, mouthY, mouthA, mouthB, 20).filter((p) => p.y > mouthY),
    },
    landmarks: { NOSE_BASE: { x: cx, y: cy + ry * 0.24 } },
  };
  return { face, head: { cx, cy, rx, ry } };
}
