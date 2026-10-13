import type { Pt } from './types';
import type { Size } from './geometry';

/** 2D affine map: x' = a·x + c·y + tx, y' = b·x + d·y + ty. */
export type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number };

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function applyAffine(m: Affine, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.tx, y: m.b * p.x + m.d * p.y + m.ty };
}

/** (m ∘ n): first n, then m. */
export function composeAffine(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
    tx: m.a * n.tx + m.c * n.ty + m.tx, ty: m.b * n.tx + m.d * n.ty + m.ty,
  };
}

export function invertAffine(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('Affine map is not invertible.');
  const a = m.d / det, b = -m.b / det, c = -m.c / det, d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

/**
 * Recovers the full camera→view affine map from where three camera points land in the view:
 * `o` = image of (0,0), `ex` = image of (1,0), `ey` = image of (0,1). The preview's mapping
 * (sensor rotation, front-camera mirroring, aspect-fill scale and crop) is affine, so sampling the
 * native converter three times per frame is exact and avoids ~150 native calls per face.
 */
export function affineFromSamples(o: Pt, ex: Pt, ey: Pt): Affine {
  return { a: ex.x - o.x, b: ex.y - o.y, c: ey.x - o.x, d: ey.y - o.y, tx: o.x, ty: o.y };
}

export type PointConverter = { convertCameraPointToViewPoint(p: Pt): Pt };

/** Samples a VisionCamera-style converter (e.g. a CameraRef). Throws while the preview isn't ready. */
export function affineFromConverter(conv: PointConverter): Affine {
  const o = conv.convertCameraPointToViewPoint({ x: 0, y: 0 });
  const ex = conv.convertCameraPointToViewPoint({ x: 1, y: 0 });
  const ey = conv.convertCameraPointToViewPoint({ x: 0, y: 1 });
  const m = affineFromSamples(o, ex, ey);
  if (![m.a, m.b, m.c, m.d, m.tx, m.ty].every(Number.isFinite)) throw new Error('Camera preview mapping is not available yet.');
  return m;
}

export type CameraModel = {
  /** Mirror the preview horizontally (VisionCamera mirrorMode 'auto' does this for the front camera). */
  mirrored: boolean;
  /** Sensor (landscape) aspect ratio, long side / short side, e.g. 16/9 or 4/3. */
  sensorAspect: number;
  /** Size of the preview view in points. */
  view: Size;
};

/**
 * Pure-JS model of the native mapping for a portrait UI, used by the dev feed and the unit tests
 * (the app itself uses the native converter via {@link affineFromConverter}).
 *
 * Camera points are AVFoundation-style normalised capture-device points: (0,0) top-left and (1,1)
 * bottom-right of the sensor in landscape orientation (home side right). Holding the phone upright
 * rotates that by 90°: sensor x runs down the screen, sensor y runs right→left. The preview fills the
 * view (aspect fill, centred crop) and mirrored previews flip horizontally.
 */
export function modelCameraToView(model: CameraModel): Affine {
  const { view, sensorAspect, mirrored } = model;
  // Upright content size in "sensor units": width = short side (1), height = long side (aspect).
  const contentW = 1, contentH = sensorAspect;
  const scale = Math.max(view.width / contentW, view.height / contentH);
  const cropX = (contentW * scale - view.width) / 2, cropY = (contentH * scale - view.height) / 2;
  // Unmirrored upright point: u = (1 - y) across, v = x down (both in [0,1]).
  const rot: Affine = { a: 0, b: 1, c: -1, d: 0, tx: 1, ty: 0 };
  const toPx: Affine = { a: contentW * scale, b: 0, c: 0, d: contentH * scale, tx: -cropX, ty: -cropY };
  let m = composeAffine(toPx, rot);
  if (mirrored) m = composeAffine({ a: -1, b: 0, c: 0, d: 1, tx: view.width, ty: 0 }, m);
  return m;
}
