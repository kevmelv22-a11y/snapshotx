import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import type { Captured } from '../lib/types';
import type { SnapPhoto } from './snapPhotoTypes';

export type { SnapPhoto } from './snapPhotoTypes';

const IDLE: SnapPhoto = { status: 'idle' };

/** Web: no on-device face detector; only pre-detected faces on the capture (test harness) are used. */
export function useSnapPhoto(capture: Captured | null): SnapPhoto {
  const [result, setResult] = useState<{ capture: Captured; snap: SnapPhoto } | null>(null);
  useEffect(() => {
    if (!capture || capture.type !== 'photo') return;
    let active = true;
    const done = (size: { width: number; height: number }) => {
      if (active) setResult({ capture, snap: { status: 'ready', uri: capture.uri, size, face: capture.face ?? null, error: capture.face === undefined ? 'Gezichtsdetectie is niet beschikbaar op web.' : undefined } });
    };
    if (capture.imageSize) { const size = capture.imageSize; Promise.resolve().then(() => done(size)); }
    else Image.getSize(capture.uri, (width, height) => done({ width, height }), () => done({ width: 1, height: 1 }));
    return () => { active = false; };
  }, [capture]);
  if (!capture || capture.type !== 'photo') return IDLE;
  return result?.capture === capture ? result.snap : { status: 'detecting', uri: capture.uri };
}
