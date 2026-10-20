import { applyAffine, invertAffine, modelCameraToView, type Affine, type CameraModel } from './cameraMapping';
import { faceFrame, mapFaceGeometry, type Size } from './geometry';
import type { FaceGeometry, Pt } from './types';

/**
 * DEV/test only: a synthetic head-movement sequence for the live lens pipeline. A still face (already
 * in preview-view points) is moved by a smooth similarity transform over time, converted into the
 * camera coordinates a detector would report (inverse of the portrait camera model), with Gaussian
 * landmark jitter and two detection dropouts.
 */
export type Motion = { angleDeg: number; dx: number; dy: number; scale: number };

export const FEED_PERIOD_S = 8;
/** Short dropout (bridged by the hold) and long dropout (lens disappears after the hold). */
export const DROPOUTS: readonly (readonly [number, number])[] = [[4.0, 4.25], [6.0, 7.0]];

export function motionAt(tS: number, view: Size): Motion {
  const w = (period: number) => Math.sin((2 * Math.PI * tS) / period);
  return { angleDeg: 18 * w(4), dx: 0.12 * view.width * w(3), dy: 0.05 * view.height * w(5), scale: 1 + 0.12 * w(6) };
}

/** Same as RN `transform: [{translateX: dx}, {translateY: dy}, {rotate}, {scale}]` about the view centre. */
export function motionAffine(m: Motion, view: Size): Affine {
  const r = (m.angleDeg * Math.PI) / 180, c = Math.cos(r) * m.scale, s = Math.sin(r) * m.scale;
  const cx = view.width / 2, cy = view.height / 2;
  return { a: c, b: s, c: -s, d: c, tx: cx + m.dx - (c * cx - s * cy), ty: cy + m.dy - (s * cx + c * cy) };
}

export const inDropout = (tS: number) => DROPOUTS.some(([a, b]) => tS % FEED_PERIOD_S >= a && tS % FEED_PERIOD_S < b);

/** Seeded PRNG + Box–Muller so feeds (and screenshots) are reproducible. */
export function gaussianSource(seed: number): () => number {
  let s = seed | 0;
  const next = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
}

export type FeedFrame = {
  tS: number;
  /** Ground truth in view points (what the lens should cover). */
  truth: FaceGeometry;
  /** What the detector reports: camera coordinates with jitter, or [] during a dropout. */
  faces: FaceGeometry[];
};

export function feedFrame(viewFace: FaceGeometry, tS: number, model: CameraModel, jitterPx: number, noise: () => number): FeedFrame {
  const truth = mapFaceGeometry(viewFace, (p) => applyAffine(motionAffine(motionAt(tS, model.view), model.view), p));
  if (inDropout(tS)) return { tS, truth, faces: [] };
  const toCamera = invertAffine(modelCameraToView(model));
  const jitter = (p: Pt): Pt => ({ x: p.x + noise() * jitterPx, y: p.y + noise() * jitterPx });
  return { tS, truth, faces: [mapFaceGeometry(truth, (p) => applyAffine(toCamera, jitter(p)))] };
}

/** Distance between drawn and true eye midpoints, in eye distances (0 = perfect). */
export function trackingError(drawn: FaceGeometry, truth: FaceGeometry): number {
  const a = faceFrame(drawn), b = faceFrame(truth);
  return Math.hypot(a.eyeMid.x - b.eyeMid.x, a.eyeMid.y - b.eyeMid.y) / b.eyeDist;
}
