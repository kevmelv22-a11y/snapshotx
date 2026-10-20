import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, type CameraRef, type Recorder, useCameraDevice, usePhotoOutput, useVideoOutput } from 'react-native-vision-camera';
import { createFaceDetectorOutput, type Face } from 'react-native-vision-camera-face-detector';
import { FaceFilterOverlay } from './FaceFilterOverlay';
import { affineFromConverter } from '../lib/face-filters/cameraMapping';
import { faceFromDetector, largestFace } from '../lib/face-filters/fromDetector';
import { LiveFaceTracker } from '../lib/face-filters/liveTracker';
import { ExpressionTracker, NEUTRAL_EXPRESSION, TRIGGER_HINTS, type ExpressionState } from '../lib/face-filters/expressions';
import { lensTrigger } from '../lib/lens-effects';
import type { FaceGeometry } from '../lib/face-filters/types';
import type { PhotoFilterId } from '../lib/photo-filters';

export type LiveLensCameraHandle = {
  /** Takes a photo with the VisionCamera photo output and resolves to a file:// URI. */
  takePhoto(flash: 'on' | 'off' | 'auto'): Promise<string>;
  /**
   * Records with the VisionCamera video output while the live lens keeps tracking on screen.
   * Resolves to a file:// URI once `stopRecording()` is called (or 60 s are reached).
   * Note: the file holds the camera image; the lens overlay is not burned into the video.
   */
  recordVideo(maxDurationS: number): Promise<string>;
  stopRecording(): Promise<void>;
};

type Props = {
  facing: 'front' | 'back';
  /** Same 0…1 scale as expo-camera's `zoom`. */
  zoom: number;
  active: boolean;
  filterId: PhotoFilterId;
  /** Called once when live lenses can't run here (no camera device, no detector, camera error). */
  onUnavailable: (reason: string) => void;
  ref?: Ref<LiveLensCameraHandle>;
};

const DEVICE_WAIT_MS = 1500;
const MAX_ZOOM = 10;

/**
 * Photo-mode camera with live face lenses: VisionCamera preview + ML Kit face detector output
 * (contours + landmarks, native coordinates already in camera space) → LiveFaceTracker (camera→view
 * affine sampled from the preview, One-Euro smoothing, short hold) → <FaceFilterOverlay live>.
 * ML Kit classification (eyes open / smiling) feeds an ExpressionTracker for triggered lenses, and
 * a video output records while the overlay keeps running (the overlay stays during recording).
 */
export function LiveLensCamera({ facing, zoom, active, filterId, onUnavailable, ref }: Props) {
  const device = useCameraDevice(facing, { physicalDevices: ['wide-angle'] });
  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({ enableAudio: true });
  const recorder = useRef<Recorder | null>(null);
  const expressions = useMemo(() => new ExpressionTracker(), []);
  const [expression, setExpression] = useState<ExpressionState>(NEUTRAL_EXPRESSION);
  const [nowMs, setNowMs] = useState(0);
  const camera = useRef<CameraRef>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [face, setFace] = useState<FaceGeometry | null>(null);
  const [searching, setSearching] = useState(false);
  const tracker = useMemo(() => new LiveFaceTracker(), []);
  const unavailable = useRef(onUnavailable);
  useEffect(() => { unavailable.current = onUnavailable; }, [onUnavailable]);

  // A new camera means a new coordinate system: drop the filter state.
  useEffect(() => { tracker.reset(); expressions.reset(); }, [facing, tracker, expressions]);

  const onFaces = useCallback((faces: Face[]) => {
    const now = Date.now();
    if (!tracker.wants(now)) return; // throttle before touching native face objects
    let affine = null;
    try { if (camera.current) affine = affineFromConverter(camera.current); } catch { affine = null; }
    const main = largestFace(faces);
    const update = tracker.push(main ? [faceFromDetector(main)] : [], affine, now);
    if (update.kind === 'face') { setFace(update.face); setSearching(!update.face); setExpression(expressions.update(update.face, now)); setNowMs(now); }
  }, [tracker, expressions]);

  // Created once per facing; the detector output is a native object, so it must stay stable.
  const detector = useMemo(() => {
    try {
      // onFaces reads the camera ref only when native detection calls it, never during render.
      // eslint-disable-next-line react-hooks/refs
      return { output: createFaceDetectorOutput({
        cameraFacing: facing,
        autoMode: true, // bounds/contours/landmarks arrive in camera coordinates
        mirrorMode: 'auto',
        performanceMode: 'fast',
        runContours: true,
        runLandmarks: true,
        runClassifications: true, // eye-open / smiling probabilities for triggered lenses
        outputResolution: 'preview',
        onFacesDetected: onFaces,
        onError: () => {}, // single failed frames are expected; the hold covers them
      }), error: null };
    } catch (e) {
      return { output: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [facing, onFaces]);

  useEffect(() => {
    if (detector.error) { unavailable.current(`Gezichtsdetectie niet beschikbaar: ${detector.error}`); return; }
    if (device) return;
    const t = setTimeout(() => unavailable.current('Geen camera gevonden voor live lenzen.'), DEVICE_WAIT_MS);
    return () => clearTimeout(t);
  }, [device, detector.error]);

  useImperativeHandle(ref, () => ({
    async takePhoto(flash) {
      const file = await photoOutput.capturePhotoToFile({ flashMode: device?.hasFlash ? flash : 'off' }, {});
      return file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`;
    },
    async recordVideo(maxDurationS) {
      const rec = await videoOutput.createRecorder({ maxDuration: maxDurationS });
      recorder.current = rec;
      return new Promise<string>((resolve, reject) => {
        rec.startRecording(
          (filePath) => { recorder.current = null; resolve(filePath.startsWith('file://') ? filePath : `file://${filePath}`); },
          (error) => { recorder.current = null; reject(error); },
        ).catch(reject);
      });
    },
    async stopRecording() { await recorder.current?.stopRecording(); },
  }), [photoOutput, videoOutput, device]);

  const trigger = lensTrigger(filterId);
  if (!device || !detector.output) return null;
  const zoomFactor = device.minZoom + Math.max(0, Math.min(1, zoom)) * (Math.min(device.maxZoom, MAX_ZOOM) - device.minZoom);
  return <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={active} mirrorMode="auto" resizeMode="cover"
      outputs={[photoOutput, videoOutput, detector.output]} zoom={zoomFactor} onError={(e) => unavailable.current(e.message)} />
    <FaceFilterOverlay filterId={filterId} face={face} width={size.width} height={size.height} live expression={expression} nowMs={nowMs} />
    {searching ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>Geen gezicht in beeld</Text></View>
      : trigger && face && !expression.count[trigger] ? <View pointerEvents="none" style={[styles.hint, styles.triggerHint]}><Text style={styles.hintText}>{TRIGGER_HINTS[trigger]}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  hint: { position: 'absolute', top: '47%', alignSelf: 'center', backgroundColor: '#000000A0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  triggerHint: { top: '18%' },
  hintText: { color: 'white', fontSize: 13, fontWeight: '700' },
});
