/**
 * App-level face description, in image pixels of the photo it was detected on.
 * Field names mirror ML Kit (react-native-vision-camera-face-detector) so a detected
 * `Face` maps 1:1; test tooling can inject the same shape.
 */
export type Pt = { x: number; y: number };
export type FaceRect = { x: number; y: number; width: number; height: number };
export type ContourName =
  | 'FACE' | 'LEFT_EYE' | 'RIGHT_EYE'
  | 'UPPER_LIP_TOP' | 'UPPER_LIP_BOTTOM' | 'LOWER_LIP_TOP' | 'LOWER_LIP_BOTTOM'
  | 'NOSE_BRIDGE' | 'NOSE_BOTTOM'
  | 'LEFT_EYEBROW_TOP' | 'RIGHT_EYEBROW_TOP';
export type LandmarkName = 'LEFT_EYE' | 'RIGHT_EYE' | 'NOSE_BASE' | 'MOUTH_LEFT' | 'MOUTH_RIGHT' | 'MOUTH_BOTTOM';
export type FaceGeometry = {
  bounds: FaceRect;
  contours?: Partial<Record<ContourName, Pt[]>>;
  landmarks?: Partial<Record<LandmarkName, Pt>>;
  rollAngle?: number;
  yawAngle?: number;
  /** ML Kit classification (0…1), only present when the detector runs with `runClassifications`. */
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
};
