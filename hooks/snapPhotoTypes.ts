import type { FaceGeometry } from '../lib/face-filters/types';

export type SnapPhoto = {
  status: 'idle' | 'detecting' | 'ready';
  /** Photo to show and bake (orientation-normalised copy on native). */
  uri?: string;
  size?: { width: number; height: number };
  /** Main face in image pixels of `uri`; null = none found / detection unavailable. */
  face?: FaceGeometry | null;
  error?: string;
};
