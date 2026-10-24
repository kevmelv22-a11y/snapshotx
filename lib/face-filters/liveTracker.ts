import { applyAffine, type Affine } from './cameraMapping';
import { mapFaceGeometry } from './geometry';
import { FaceSmoother, DEFAULT_SMOOTHER, type SmootherOptions } from './smoothing';
import type { FaceGeometry } from './types';

export type LiveTrackerOptions = SmootherOptions & {
  /** Minimum time between overlay updates (ms); 33 ≈ 30 fps. Extra detections are dropped. */
  minIntervalMs: number;
};

export const DEFAULT_LIVE: LiveTrackerOptions = { ...DEFAULT_SMOOTHER, minIntervalMs: 33 };

/** Result of one detector callback: `skip` = throttled (keep drawing what you have). */
export type LiveUpdate = { kind: 'skip' } | { kind: 'face'; face: FaceGeometry | null };

/**
 * The live lens pipeline, independent of React and native code so the simulator feed and the unit
 * tests run exactly what the camera runs:
 *   detector faces (camera coordinates) → largest face → camera→view affine → One-Euro smoothing
 *   with a short hold → face in preview-view points for <FaceFilterOverlay>.
 */
export class LiveFaceTracker {
  private readonly smoother: FaceSmoother;
  private readonly opts: LiveTrackerOptions;
  private lastEmit = -Infinity;
  constructor(opts: LiveTrackerOptions = DEFAULT_LIVE) {
    this.opts = opts;
    this.smoother = new FaceSmoother(opts);
  }

  /** Cheap pre-check so callers can skip reading native face data for throttled frames. */
  wants(tMs: number): boolean {
    return tMs - this.lastEmit >= this.opts.minIntervalMs;
  }

  push(faces: readonly FaceGeometry[], cameraToView: Affine | null, tMs: number): LiveUpdate {
    if (tMs - this.lastEmit < this.opts.minIntervalMs) return { kind: 'skip' };
    this.lastEmit = tMs;
    const main = faces.reduce<FaceGeometry | null>((best, f) =>
      !best || f.bounds.width * f.bounds.height > best.bounds.width * best.bounds.height ? f : best, null);
    // Without a usable mapping (preview not ready yet) treat the frame like a miss so the hold applies.
    const mapped = main && cameraToView ? mapFaceGeometry(main, (p) => applyAffine(cameraToView, p)) : null;
    // Roll/yaw from the detector are in sensor orientation; the overlay derives roll from the eyes.
    const face = mapped ? { ...mapped, rollAngle: undefined, yawAngle: undefined } : null;
    return { kind: 'face', face: this.smoother.update(face, tMs) };
  }

  reset() { this.smoother.reset(); this.lastEmit = -Infinity; }
}
