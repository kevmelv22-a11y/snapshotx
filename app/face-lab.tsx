import React, { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, type CameraRef, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { useFaceDetectorOutput, useImageFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { imageRectToCoverView, type Rect, type Size } from '../lib/face-mapping';

/** Diagnostic route only. The production Expo Camera and photo overlays remain unchanged. */
export default function FaceLab() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const camera = useRef<CameraRef>(null);
  const lastUpdate = useRef(0);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(position);
  const photoOutput = usePhotoOutput();
  const imageDetector = useImageFaceDetector({ performanceMode: 'fast', runLandmarks: true });
  const [liveRect, setLiveRect] = useState<Rect | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<{ uri: string; size: Size; face: Rect | null } | null>(null);
  const [shotView, setShotView] = useState<Size | null>(null);

  const onFacesDetected = useCallback((faces: Face[]) => {
    if (Date.now() - lastUpdate.current < 100) return;
    lastUpdate.current = Date.now();
    setLiveCount(faces.length);
    const face = faces.reduce<Face | null>((best, next) =>
      !best || next.bounds.width * next.bounds.height > best.bounds.width * best.bounds.height ? next : best, null);
    if (!face || !camera.current) {
      setLiveRect(null);
      return;
    }
    try {
      // autoMode below puts bounds in VisionCamera camera-space; the ref handles preview crop/mirroring.
      const a = camera.current.convertCameraPointToViewPoint({ x: face.bounds.x, y: face.bounds.y });
      const b = camera.current.convertCameraPointToViewPoint({
        x: face.bounds.x + face.bounds.width,
        y: face.bounds.y + face.bounds.height,
      });
      setLiveRect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
    } catch {
      setLiveRect(null); // Preview may not be configured yet.
    }
  }, []);

  const faceOutput = useFaceDetectorOutput({
    cameraFacing: position,
    autoMode: true,
    mirrorMode: 'auto',
    performanceMode: 'fast',
    outputResolution: 'preview',
    onFacesDetected,
    onError: (e) => setError(e.message),
  });

  async function capture() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { filePath } = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      const [width, height] = await new Promise<[number, number]>((resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve([w, h]), reject));
      // Detect on the actual saved photo; don't reuse potentially stale preview coordinates.
      const faces = imageDetector.detectFaces(uri);
      const largest = faces.reduce<Face | null>((best, next) =>
        !best || next.bounds.width * next.bounds.height > best.bounds.width * best.bounds.height ? next : best, null);
      setShot({ uri, size: { width, height }, face: largest ? { ...largest.bounds } : null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      Alert.alert('Face Lab', message);
    } finally {
      setBusy(false);
    }
  }

  const mapped = shot?.face && shotView ? imageRectToCoverView(shot.face, shot.size, shotView) : null;
  return <View style={styles.root}>
    {hasPermission && device && !shot && <Camera
      ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={focused}
      mirrorMode="auto" outputs={[photoOutput, faceOutput]} resizeMode="cover"
      onError={(e) => setError(e.message)}
    />}
    {shot && <View style={styles.shot} onLayout={(e) => setShotView(e.nativeEvent.layout)}>
      <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {mapped && <View pointerEvents="none" style={[styles.box, { left: mapped.x, top: mapped.y, width: mapped.width, height: mapped.height }]} />}
    </View>}
    {!shot && liveRect && <View pointerEvents="none" style={[styles.box, { left: liveRect.x, top: liveRect.y, width: liveRect.width, height: liveRect.height }]} />}
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Terug"><Text style={styles.action}>‹ Terug</Text></Pressable>
      <Text style={styles.label}>Face Lab · {shot ? shot.face ? 'foto: gezicht' : 'foto: geen gezicht' : `${liveCount} gezicht(en)`}</Text>
    </View>
    {!hasPermission ? <View style={styles.center}><Text style={styles.label}>Camera-toegang nodig</Text><Pressable onPress={() => void requestPermission()}><Text style={styles.action}>Toestaan</Text></Pressable></View>
      : !device ? <View style={styles.center}><Text style={styles.label}>Geen camera beschikbaar</Text></View> : null}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
      {shot ? <Pressable onPress={() => { setShot(null); setShotView(null); }}><Text style={styles.action}>Opnieuw</Text></Pressable> : <>
        <Pressable onPress={() => { setLiveRect(null); setPosition(p => p === 'front' ? 'back' : 'front'); }}><Text style={styles.action}>Draai camera</Text></Pressable>
        <Pressable onPress={() => void capture()} disabled={!hasPermission || !device || busy}><Text style={styles.action}>{busy ? 'Bezig…' : 'Foto + detectie'}</Text></Pressable>
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070512' },
  shot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box: { position: 'absolute', borderColor: '#FFE436', borderWidth: 3, borderRadius: 16 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, padding: 16, backgroundColor: '#08090ECC', flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#08090ECC', flexDirection: 'row', justifyContent: 'space-around' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  label: { color: 'white', fontSize: 15, fontWeight: '700' },
  action: { color: '#FFE436', fontSize: 17, fontWeight: '700' },
  error: { position: 'absolute', top: 115, left: 12, right: 12, color: '#FF6B6B', backgroundColor: '#100515CC', padding: 10 },
});
