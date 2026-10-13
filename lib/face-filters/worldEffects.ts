import type { Pt } from './types';

/**
 * 2D "world" effects that need no face (rear camera, or no face in view): falling confetti, snow
 * and hearts, plus short particle bursts used by expression-triggered lenses. Everything is a pure
 * function of time and a seed, so a frame can be rendered (and tested) for any t without state.
 */
export type WorldKind = 'confetti' | 'snow' | 'hearts';
export type Particle = { x: number; y: number; size: number; rotDeg: number; opacity: number; color: string; shape: 'rect' | 'dot' | 'heart' | 'star' };
type Size = { width: number; height: number };

/** Deterministic hash → [0,1) for (seed, i, k). */
export function rand(seed: number, i: number, k: number): number {
  let h = (seed * 374761393 + i * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const CONFIG: Record<WorldKind, { count: number; speed: [number, number]; size: [number, number]; sway: number; spin: number; colors: string[]; shape: Particle['shape'] }> = {
  confetti: { count: 70, speed: [0.18, 0.34], size: [7, 13], sway: 18, spin: 260, colors: ['#FFFC00', '#FF4FA3', '#3CD3FF', '#7CFF6B', '#FF8A3D', '#B86BFF'], shape: 'rect' },
  snow: { count: 90, speed: [0.05, 0.12], size: [3, 9], sway: 22, spin: 0, colors: ['#FFFFFF', '#EAF4FF'], shape: 'dot' },
  hearts: { count: 30, speed: [0.08, 0.16], size: [14, 26], sway: 26, spin: 25, colors: ['#FF3E8A', '#FF6FB0', '#E6194B', '#FFB3D1'], shape: 'heart' },
};

/** Particles for one frame: each falls at its own speed (fraction of the view height per second) and wraps. */
export function worldParticles(kind: WorldKind, tS: number, view: Size, seed = 7): Particle[] {
  const c = CONFIG[kind];
  if (view.width <= 0 || view.height <= 0) return [];
  // Scale density with the area relative to a phone screen so tiles stay readable.
  const n = Math.max(24, Math.round(c.count * Math.min(1, (view.width * view.height) / (393 * 852))));
  const margin = c.size[1] * 2;
  const span = view.height + 2 * margin;
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const speed = (c.speed[0] + rand(seed, i, 1) * (c.speed[1] - c.speed[0])) * view.height;
    const y = ((rand(seed, i, 2) * span + speed * tS) % span + span) % span - margin;
    const phase = rand(seed, i, 3) * Math.PI * 2;
    const x = rand(seed, i, 4) * view.width + c.sway * Math.sin(tS * (0.8 + rand(seed, i, 5)) + phase);
    out.push({ x, y, size: c.size[0] + rand(seed, i, 6) * (c.size[1] - c.size[0]), rotDeg: (rand(seed, i, 7) * 360 + c.spin * tS * (rand(seed, i, 8) - 0.5) * 2) % 360,
      opacity: kind === 'snow' ? 0.55 + 0.45 * rand(seed, i, 9) : 1, color: c.colors[Math.floor(rand(seed, i, 10) * c.colors.length)], shape: c.shape });
  }
  return out;
}

export const BURST_LIFE_S = 0.9;

/**
 * A burst from `origin` (e.g. the eyes on a blink, the cheeks on a smile): particles fly outwards,
 * fall under gravity and fade; none are left after BURST_LIFE_S. `scale` = eye distance in points.
 */
export function burstParticles(origin: Pt, ageS: number, scale: number, seed: number, shape: Particle['shape'] = 'star', colors = ['#FFFC00', '#FFFFFF', '#FFD34D'], n = 14): Particle[] {
  if (ageS < 0 || ageS >= BURST_LIFE_S) return [];
  const out: Particle[] = [];
  const k = ageS / BURST_LIFE_S;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(seed, i, 1) * 0.6;
    const v = scale * (1.4 + rand(seed, i, 2) * 1.4);
    const g = scale * 3;
    out.push({ x: origin.x + Math.cos(a) * v * ageS, y: origin.y + Math.sin(a) * v * ageS + 0.5 * g * ageS * ageS,
      size: scale * (0.12 + rand(seed, i, 3) * 0.12) * (1 - 0.4 * k), rotDeg: rand(seed, i, 4) * 360 + 200 * ageS, opacity: 1 - k * k,
      color: colors[i % colors.length], shape });
  }
  return out;
}
