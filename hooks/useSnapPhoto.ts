import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useImageFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { faceFromDetector, largestFace } from '../lib/face-filters/fromDetector';
import type { Captured } from '../lib/types';
import type { SnapPhoto } from './snapPhotoTypes';

export type { SnapPhoto } from './snapPhotoTypes';

const MAX_WIDTH = 1440;
const IDLE: SnapPhoto = { status: 'idle' };
const getSize = (uri: string) => new Promise<{ width: number; height: number }>((resolve, reject) =>
  Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Prepares a captured photo for the snap editor: bakes EXIF orientation into the pixels (so ML Kit,
 * <Image> and the baked snap share one coordinate space), limits its size, and detects the main face
 * with landmarks + contours. Pre-detected faces on the capture (test harness) are used as-is.
 */
export function useSnapPhoto(capture: Captured | null): SnapPhoto {
  const options = useMemo(() => ({ performanceMode: 'accurate' as const, runLandmarks: true, runContours: true, minFaceSize: 0.1 }), []);
  const detector = useImageFaceDetector(options);
  // Read through a ref so a detector re-created by a re-render never restarts preparation.
  const detectorRef = useRef(detector);
  useEffect(() => { detectorRef.current = detector; }, [detector]);
  const [result, setResult] = useState<{ capture: Captured; snap: SnapPhoto } | null>(null);
  useEffect(() => {
    if (!capture || capture.type !== 'photo') return;
    let active = true;
    const finish = (snap: SnapPhoto) => { if (active) setResult({ capture, snap }); };
    (async () => {
      if (capture.face !== undefined) {
        finish({ status: 'ready', uri: capture.uri, size: capture.imageSize ?? await getSize(capture.uri), face: capture.face });
        return;
      }
      const original = await getSize(capture.uri);
      let ctx = ImageManipulator.manipulate(capture.uri);
      if (original.width > MAX_WIDTH) ctx = ctx.resize({ width: MAX_WIDTH });
      const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
      const size = { width: saved.width, height: saved.height };
      try {
        // detectFaces is synchronous natively; tolerate async stubs (simulator build) too.
        const out = detectorRef.current.detectFaces(saved.uri) as Face[] | Promise<Face[]>;
        const main = largestFace(Array.isArray(out) ? out : await out);
        finish({ status: 'ready', uri: saved.uri, size, face: main ? faceFromDetector(main) : null });
      } catch (e) {
        finish({ status: 'ready', uri: saved.uri, size, face: null, error: message(e) });
      }
    })().catch((e: unknown) => finish({ status: 'ready', uri: capture.uri, face: null, error: message(e) }));
    return () => { active = false; };
  }, [capture]);
  if (!capture || capture.type !== 'photo') return IDLE;
  return result?.capture === capture ? result.snap : { status: 'detecting', uri: capture.uri };
}
