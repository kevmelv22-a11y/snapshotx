import type { ContourName, FaceGeometry, LandmarkName, Pt } from './types';

/** Structural subset of react-native-vision-camera-face-detector's `Face` (kept import-free for web/tests). */
export type DetectedFace = {
  bounds: { x: number; y: number; width: number; height: number };
  contours?: Partial<Record<ContourName, Pt[]>>;
  landmarks?: Partial<Record<LandmarkName, Pt>>;
  rollAngle?: number;
  yawAngle?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
};

const CONTOURS: ContourName[] = ['FACE', 'LEFT_EYE', 'RIGHT_EYE', 'UPPER_LIP_TOP', 'UPPER_LIP_BOTTOM', 'LOWER_LIP_TOP', 'LOWER_LIP_BOTTOM', 'NOSE_BRIDGE', 'NOSE_BOTTOM', 'LEFT_EYEBROW_TOP', 'RIGHT_EYEBROW_TOP'];
const LANDMARKS: LandmarkName[] = ['LEFT_EYE', 'RIGHT_EYE', 'NOSE_BASE', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'MOUTH_BOTTOM'];
/** ML Kit reports -1 / undefined when a classification is unavailable. */
const prob = (v?: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : undefined);
const ok = (p?: Pt): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Copies a detector face into plain data (native hybrid objects must not be kept in React state). */
export function faceFromDetector(face: DetectedFace): FaceGeometry {
  const contours: FaceGeometry['contours'] = {};
  for (const name of CONTOURS) {
    const pts = face.contours?.[name];
    if (pts?.length) contours[name] = pts.filter(ok).map((p) => ({ x: p.x, y: p.y }));
  }
  const landmarks: FaceGeometry['landmarks'] = {};
  for (const name of LANDMARKS) {
    const p = face.landmarks?.[name];
    if (ok(p)) landmarks[name] = { x: p.x, y: p.y };
  }
  const b = face.bounds;
  return { bounds: { x: b.x, y: b.y, width: b.width, height: b.height }, contours, landmarks, rollAngle: face.rollAngle, yawAngle: face.yawAngle,
    leftEyeOpenProbability: prob(face.leftEyeOpenProbability), rightEyeOpenProbability: prob(face.rightEyeOpenProbability), smilingProbability: prob(face.smilingProbability) };
}

/** The face with the largest area (the person taking the selfie / main subject). */
export function largestFace<T extends { bounds: { width: number; height: number } }>(faces: readonly T[]): T | null {
  return faces.reduce<T | null>((best, f) => (!best || f.bounds.width * f.bounds.height > best.bounds.width * best.bounds.height ? f : best), null);
}
