import { centroid, faceFrame } from './geometry';
import type { FaceGeometry, FaceRect, Pt } from './types';

export type SmootherOptions = {
  /** One-Euro minimum cutoff (Hz) while the face is still: lower = steadier, more lag. */
  minCutoff: number;
  /** Speed coefficient: cutoff grows by `beta` Hz per eye-distance/second of head movement. */
  beta: number;
  /** Cutoff (Hz) used to smooth the speed estimate itself. */
  dCutoff: number;
  /** Speeds below this (eye distances/s) count as "still": landmark noise alone must not open the filter. */
  speedDeadzone: number;
  /** Keep showing the last face this long (ms) when detection briefly loses it. */
  holdMs: number;
  /** Jumps larger than this many eye distances between frames reset the filter (new face / re-acquire). */
  resetJump: number;
};

export const DEFAULT_SMOOTHER: SmootherOptions = { minCutoff: 0.7, beta: 4, dCutoff: 1, speedDeadzone: 0.25, holdMs: 400, resetJump: 1.5 };

const alphaFor = (cutoffHz: number, dtS: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtS);
};

/** Classic scalar One-Euro filter (Casiez et al. 2012). */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  constructor(minCutoff = 1, beta = 0, dCutoff = 1) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
  }
  filter(value: number, tMs: number): number {
    if (this.x === null) { this.x = value; this.t = tMs; return value; }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += alphaFor(this.dCutoff, dt) * (rawDx - this.dx);
    const a = alphaFor(this.minCutoff + this.beta * Math.abs(this.dx), dt);
    this.x += a * (value - this.x);
    return this.x;
  }
  reset() { this.x = null; this.dx = 0; }
}

type Flat = { values: number[]; layout: string };

/** Flattens every coordinate of a face (bounds, contours, landmarks) into one vector with a stable layout key. */
function flatten(face: FaceGeometry): Flat {
  const values: number[] = [face.bounds.x, face.bounds.y, face.bounds.width, face.bounds.height];
  const parts: string[] = [];
  for (const k of Object.keys(face.contours ?? {}).sort()) {
    const pts = face.contours?.[k as keyof NonNullable<FaceGeometry['contours']>] ?? [];
    parts.push(`${k}:${pts.length}`);
    for (const p of pts) values.push(p.x, p.y);
  }
  for (const k of Object.keys(face.landmarks ?? {}).sort()) {
    const p = face.landmarks?.[k as keyof NonNullable<FaceGeometry['landmarks']>];
    if (!p) continue;
    parts.push(k);
    values.push(p.x, p.y);
  }
  return { values, layout: parts.join('|') };
}

function unflatten(template: FaceGeometry, values: number[]): FaceGeometry {
  let i = 4;
  const bounds: FaceRect = { x: values[0], y: values[1], width: values[2], height: values[3] };
  const contours: NonNullable<FaceGeometry['contours']> = {};
  for (const k of Object.keys(template.contours ?? {}).sort()) {
    const key = k as keyof typeof contours;
    const n = template.contours?.[key]?.length ?? 0;
    const pts: Pt[] = [];
    for (let j = 0; j < n; j++, i += 2) pts.push({ x: values[i], y: values[i + 1] });
    contours[key] = pts;
  }
  const landmarks: NonNullable<FaceGeometry['landmarks']> = {};
  for (const k of Object.keys(template.landmarks ?? {}).sort()) {
    const key = k as keyof typeof landmarks;
    if (!template.landmarks?.[key]) continue;
    landmarks[key] = { x: values[i], y: values[i + 1] };
    i += 2;
  }
  return { ...template, bounds, contours, landmarks };
}

const anchorOf = (face: FaceGeometry) => {
  const f = faceFrame(face);
  return { mid: f.eyeMid, d: f.eyeDist, center: face.contours?.FACE?.length ? centroid(face.contours.FACE) : f.center };
};

/**
 * Smooths a face over time with a "rigid" One-Euro filter: the cutoff is driven by the speed of
 * the whole head (eye midpoint, in eye distances per second) and the same blend factor is applied
 * to every landmark, so the mask follows quick moves without lag but doesn't jitter or wobble when
 * still. Short detection dropouts are bridged by holding the last face for `holdMs`.
 */
export class FaceSmoother {
  private state: { flat: Flat; face: FaceGeometry; speed: number; t: number; mid: Pt; d: number } | null = null;
  private lastSeen = -Infinity;
  private readonly opts: SmootherOptions;
  constructor(opts: SmootherOptions = DEFAULT_SMOOTHER) { this.opts = opts; }

  /** Feed one detection (or null when no face was found) at time `tMs`; returns the face to draw. */
  update(face: FaceGeometry | null, tMs: number): FaceGeometry | null {
    if (!face) {
      if (this.state && tMs - this.lastSeen <= this.opts.holdMs) return this.state.face;
      this.state = null;
      return null;
    }
    this.lastSeen = tMs;
    const flat = flatten(face);
    const { mid, d } = anchorOf(face);
    const s = this.state;
    if (!s || s.flat.layout !== flat.layout || s.flat.values.length !== flat.values.length
      || Math.hypot(mid.x - s.mid.x, mid.y - s.mid.y) > this.opts.resetJump * Math.max(d, s.d)) {
      this.state = { flat, face, speed: 0, t: tMs, mid, d };
      return face;
    }
    const dt = Math.max(1e-3, (tMs - s.t) / 1000);
    const rawSpeed = Math.hypot(mid.x - s.mid.x, mid.y - s.mid.y) / Math.max(1e-3, d) / dt;
    const speed = s.speed + alphaFor(this.opts.dCutoff, dt) * (rawSpeed - s.speed);
    const a = alphaFor(this.opts.minCutoff + this.opts.beta * Math.max(0, speed - this.opts.speedDeadzone), dt);
    const values = s.flat.values.map((v, i) => v + a * (flat.values[i] - v));
    const next = unflatten(face, values);
    const anchor = anchorOf(next);
    this.state = { flat: { values, layout: flat.layout }, face: next, speed, t: tMs, mid: anchor.mid, d: anchor.d };
    return next;
  }

  reset() { this.state = null; this.lastSeen = -Infinity; }
}
