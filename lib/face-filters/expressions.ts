import { centroid, faceFrame } from './geometry';
import type { FaceGeometry, Pt } from './types';

/**
 * Expression triggers for live lenses (open mouth, smile, blink). Pure and React-free so the unit
 * tests run exactly what the camera runs. Measures come from ML Kit classification probabilities
 * when the detector provides them, otherwise from contours/landmarks, normalised by eye distance
 * so they do not depend on how close the face is.
 */
export type Trigger = 'mouthOpen' | 'smile' | 'blink';
export const TRIGGERS: readonly Trigger[] = ['mouthOpen', 'smile', 'blink'];

const finite = (p?: Pt): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Inner-lip gap / eye distance (≈0.02 closed, >0.3 wide open). Undefined without lip data. */
export function mouthOpenRatio(face: FaceGeometry): number | undefined {
  const f = faceFrame(face);
  const up = face.contours?.UPPER_LIP_BOTTOM?.filter(finite);
  const low = face.contours?.LOWER_LIP_TOP?.filter(finite);
  if (up && low && up.length >= 3 && low.length >= 3) {
    // Middle third of each inner lip: the corners always touch, the centre opens.
    const mid = (pts: Pt[]) => { const s = [...pts].sort((a, b) => dot(a, f.ux) - dot(b, f.ux)); const k = Math.floor(s.length / 3); return centroid(s.slice(k, s.length - k)); };
    const a = mid(up), b = mid(low);
    return Math.max(0, dot({ x: b.x - a.x, y: b.y - a.y }, f.uy)) / f.eyeDist;
  }
  // Landmark fallback: how far the lower lip sits below the mouth corners (≈0.3 closed).
  const l = face.landmarks;
  if (finite(l?.MOUTH_LEFT) && finite(l?.MOUTH_RIGHT) && finite(l?.MOUTH_BOTTOM)) {
    const c = { x: (l.MOUTH_LEFT.x + l.MOUTH_RIGHT.x) / 2, y: (l.MOUTH_LEFT.y + l.MOUTH_RIGHT.y) / 2 };
    return Math.max(0, dot({ x: l.MOUTH_BOTTOM.x - c.x, y: l.MOUTH_BOTTOM.y - c.y }, f.uy)) / f.eyeDist - 0.25;
  }
  return undefined;
}

/** Eye height / width of an eye contour (≈0.35 open, <0.12 closed). */
function eyeAspect(pts: Pt[] | undefined, face: FaceGeometry): number | undefined {
  const p = pts?.filter(finite);
  if (!p || p.length < 6) return undefined;
  const f = faceFrame(face);
  const xs = p.map((q) => dot(q, f.ux)), ys = p.map((q) => dot(q, f.uy));
  const w = Math.max(...xs) - Math.min(...xs);
  return w > 0 ? (Math.max(...ys) - Math.min(...ys)) / w : undefined;
}

/** 0 = both eyes closed … 1 = both open. Probabilities first, contour aspect ratio as fallback. */
export function eyeOpenness(face: FaceGeometry): number | undefined {
  const { leftEyeOpenProbability: pl, rightEyeOpenProbability: pr } = face;
  if (pl !== undefined && pr !== undefined) return Math.max(pl, pr); // both must close to count as a blink
  const a = eyeAspect(face.contours?.LEFT_EYE, face), b = eyeAspect(face.contours?.RIGHT_EYE, face);
  if (a === undefined || b === undefined) return undefined;
  return clamp01((Math.max(a, b) - 0.12) / 0.2);
}

/** 0…1 smile score: ML Kit probability, or mouth width relative to eye distance as fallback. */
export function smileScore(face: FaceGeometry): number | undefined {
  if (face.smilingProbability !== undefined) return face.smilingProbability;
  const f = faceFrame(face);
  const c = face.contours ?? {};
  const lips = [...(c.UPPER_LIP_TOP ?? []), ...(c.LOWER_LIP_BOTTOM ?? [])].filter(finite);
  let w: number | undefined;
  if (lips.length >= 4) { const xs = lips.map((q) => dot(q, f.ux)); w = Math.max(...xs) - Math.min(...xs); }
  else if (finite(face.landmarks?.MOUTH_LEFT) && finite(face.landmarks?.MOUTH_RIGHT)) w = Math.abs(dot(face.landmarks.MOUTH_RIGHT, f.ux) - dot(face.landmarks.MOUTH_LEFT, f.ux));
  // Neutral mouth ≈ 0.9 eye distances wide, a broad smile ≈ 1.25.
  return w === undefined ? undefined : clamp01((w / f.eyeDist - 0.9) / 0.35);
}

export type HysteresisOptions = {
  /** Value at/above which the trigger turns on (or at/below, when `invert`). */
  on: number;
  /** Value it has to fall back past before it turns off again (the dead band prevents flicker). */
  off: number;
  /** The value must stay past `on` this long before the trigger fires (debounce). */
  minOnMs: number;
  /** …and past `off` this long before it releases. */
  minOffMs: number;
  /** Trigger on low values (eyes closed) instead of high ones. */
  invert?: boolean;
};

export type TriggerStep = { active: boolean; rose: boolean; fell: boolean };

/** Two-threshold (Schmitt) trigger with debounce times. Missing measurements keep the state. */
export class HysteresisTrigger {
  private readonly o: HysteresisOptions;
  private activeState = false;
  private pendingSince: number | null = null;
  constructor(o: HysteresisOptions) {
    if (o.invert ? o.off <= o.on : o.off >= o.on) throw new Error('off threshold must lie on the released side of on');
    this.o = o;
  }
  get active() { return this.activeState; }
  update(value: number | undefined, tMs: number): TriggerStep {
    if (value === undefined || !Number.isFinite(value)) { this.pendingSince = null; return { active: this.activeState, rose: false, fell: false }; }
    const { on, off, invert } = this.o;
    const pastOn = invert ? value <= on : value >= on;
    const pastOff = invert ? value >= off : value <= off;
    const wantsChange = this.activeState ? pastOff : pastOn;
    if (!wantsChange) { this.pendingSince = null; return { active: this.activeState, rose: false, fell: false }; }
    if (this.pendingSince === null) this.pendingSince = tMs;
    const need = this.activeState ? this.o.minOffMs : this.o.minOnMs;
    if (tMs - this.pendingSince < need) return { active: this.activeState, rose: false, fell: false };
    this.activeState = !this.activeState;
    this.pendingSince = null;
    return { active: this.activeState, rose: this.activeState, fell: !this.activeState };
  }
  reset() { this.activeState = false; this.pendingSince = null; }
}

export const TRIGGER_OPTIONS: Record<Trigger, HysteresisOptions> = {
  mouthOpen: { on: 0.22, off: 0.13, minOnMs: 60, minOffMs: 120 },
  smile: { on: 0.7, off: 0.45, minOnMs: 120, minOffMs: 200 },
  blink: { on: 0.25, off: 0.5, minOnMs: 0, minOffMs: 60, invert: true },
};

const MEASURE: Record<Trigger, (f: FaceGeometry) => number | undefined> = { mouthOpen: mouthOpenRatio, smile: smileScore, blink: eyeOpenness };

export type ExpressionState = {
  active: Record<Trigger, boolean>;
  /** Time (ms) of the most recent rising edge per trigger, or null. */
  lastRise: Record<Trigger, number | null>;
  /** Rising edges since the tracker started (useful for counters and tests). */
  count: Record<Trigger, number>;
};

export const NEUTRAL_EXPRESSION: ExpressionState = {
  active: { mouthOpen: false, smile: false, blink: false },
  lastRise: { mouthOpen: null, smile: null, blink: null },
  count: { mouthOpen: 0, smile: 0, blink: 0 },
};

/** Runs one hysteresis trigger per expression on the tracked face. Losing the face releases all. */
export class ExpressionTracker {
  private readonly triggers: Record<Trigger, HysteresisTrigger>;
  private state: ExpressionState = NEUTRAL_EXPRESSION;
  constructor(opts: Record<Trigger, HysteresisOptions> = TRIGGER_OPTIONS) {
    this.triggers = { mouthOpen: new HysteresisTrigger(opts.mouthOpen), smile: new HysteresisTrigger(opts.smile), blink: new HysteresisTrigger(opts.blink) };
  }
  update(face: FaceGeometry | null, tMs: number): ExpressionState {
    if (!face) {
      for (const t of TRIGGERS) this.triggers[t].reset();
      this.state = { ...this.state, active: { mouthOpen: false, smile: false, blink: false } };
      return this.state;
    }
    const active = { ...this.state.active }, lastRise = { ...this.state.lastRise }, count = { ...this.state.count };
    for (const t of TRIGGERS) {
      const step = this.triggers[t].update(MEASURE[t](face), tMs);
      active[t] = step.active;
      if (step.rose) { lastRise[t] = tMs; count[t]++; }
    }
    this.state = { active, lastRise, count };
    return this.state;
  }
  reset() { for (const t of TRIGGERS) this.triggers[t].reset(); this.state = NEUTRAL_EXPRESSION; }
}

/** How long a blink-triggered burst keeps playing after the blink (ms). */
export const BURST_MS = 900;

/**
 * Whether a lens effect bound to `trigger` should show: mouth/smile effects last while the
 * expression is held; a blink is momentary, so it plays a burst for BURST_MS.
 */
export function effectActive(trigger: Trigger, s: ExpressionState, tMs: number): boolean {
  if (trigger === 'blink') { const r = s.lastRise.blink; return r !== null && tMs - r >= 0 && tMs - r < BURST_MS; }
  return s.active[trigger];
}

/** Age of the current effect in seconds (for animation), 0 when inactive. */
export function effectAgeS(trigger: Trigger, s: ExpressionState, tMs: number): number {
  const r = s.lastRise[trigger];
  return effectActive(trigger, s, tMs) && r !== null ? (tMs - r) / 1000 : 0;
}

export const TRIGGER_HINTS: Record<Trigger, string> = {
  mouthOpen: 'Open je mond!',
  smile: 'Lach eens!',
  blink: 'Knipper met je ogen!',
};
