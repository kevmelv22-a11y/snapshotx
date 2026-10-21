import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { FaceFilterOverlay } from '../components/FaceFilterOverlay';
import { affineFromConverter, applyAffine, modelCameraToView, type CameraModel } from '../lib/face-filters/cameraMapping';
import { FEED_PERIOD_S, feedFrame, gaussianSource, inDropout, motionAt, trackingError, type FeedFrame } from '../lib/face-filters/devFeed';
import { coverTransform, faceFrame, mapFaceGeometry } from '../lib/face-filters/geometry';
import { LiveFaceTracker } from '../lib/face-filters/liveTracker';
import type { FaceGeometry } from '../lib/face-filters/types';
import { PHOTO_FILTERS, type PhotoFilterId } from '../lib/photo-filters';

const FEED_MS = 66; // ~15 detector results per second

type Sim = { frame: FeedFrame; drawn: FaceGeometry | null; fps: number };

/**
 * DEV-ONLY (redirects in release builds): drives the live lens pipeline without a camera. A still
 * selfie (`img`) with detector-style landmarks (`lm`, image pixels) is moved along a synthetic head
 * path; each step is converted into camera coordinates (camera model: 90° sensor rotation,
 * `mirrored`, `aspect` aspect-fill crop), jittered and fed through the same LiveFaceTracker +
 * <FaceFilterOverlay live> as the real camera. `freeze=<s>` replays up to that time and stops.
 */
export default function DevLiveLens() {
  const p = useLocalSearchParams<{ img?: string; lm?: string; filter?: string; freeze?: string; jitter?: string; dots?: string; mirrored?: string; aspect?: string }>();
  const [view, setView] = useState({ width: 0, height: 0 });
  const [data, setData] = useState<{ image: { width: number; height: number }; face: FaceGeometry } | null>(null);
  const [error, setError] = useState('');
  const [sim, setSim] = useState<Sim | null>(null);
  const filterId = (PHOTO_FILTERS.some((f) => f.id === p.filter) ? p.filter : 'balaclava') as PhotoFilterId;
  const jitter = Number(p.jitter ?? 2);
  const mirrored = p.mirrored !== '0'; // 1 = front camera (default), 0 = back camera
  const aspect = Number(p.aspect ?? 16 / 9);
  const freeze = p.freeze !== undefined ? Number(p.freeze) : null;
  const started = useRef(0);

  useEffect(() => {
    if (!__DEV__ || !p.lm) return;
    let active = true;
    fetch(p.lm).then((r) => r.json()).then((d) => { if (active) setData(d); }).catch((e: unknown) => setError(String(e)));
    return () => { active = false; };
  }, [p.lm]);

  // Landmarks in view points as the preview would show the still photo (aspect fill).
  const viewFace = useMemo(() => (data && view.width > 0 ? mapFaceGeometry(data.face, coverTransform(data.image, view)) : null), [data, view]);

  useEffect(() => {
    if (!viewFace) return;
    const model: CameraModel = { mirrored, sensorAspect: aspect, view };
    // In the app this converter is the VisionCamera preview (CameraRef); here it is the JS camera model.
    const converter = { convertCameraPointToViewPoint: (pt: { x: number; y: number }) => applyAffine(modelCameraToView(model), pt) };
    const tracker = new LiveFaceTracker();
    const noise = gaussianSource(42);
    let drawn: FaceGeometry | null = null;
    let fed = 0;
    const step = (ms: number): FeedFrame => {
      const frame = feedFrame(viewFace, ms / 1000, model, jitter, noise);
      const u = tracker.push(frame.faces, affineFromConverter(converter), ms);
      if (u.kind === 'face') drawn = u.face;
      fed++;
      return frame;
    };
    if (freeze !== null) {
      let last: FeedFrame | null = null;
      for (let ms = 0; ms <= freeze * 1000 + 1e-6; ms += FEED_MS) last = step(ms);
      const frozen = last;
      if (frozen) Promise.resolve().then(() => setSim({ frame: frozen, drawn, fps: 1000 / FEED_MS }));
      return;
    }
    started.current = Date.now();
    const id = setInterval(() => {
      const frame = step(Date.now() - started.current);
      const fps = fed / Math.max(0.001, (Date.now() - started.current) / 1000);
      setSim({ frame, drawn, fps });
    }, FEED_MS);
    return () => clearInterval(id);
  }, [viewFace, view, jitter, freeze, mirrored, aspect]);

  if (!__DEV__) return <Redirect href="/" />;
  const t = sim?.frame.tS ?? 0;
  const m = motionAt(t, view);
  const err = sim?.drawn ? trackingError(sim.drawn, sim.frame.truth) : null;
  const truthMarks = sim && p.dots === '1' ? (() => { const f = faceFrame(sim.frame.truth); return [f.eyeL, f.eyeR, f.mouth]; })() : [];
  return <View style={styles.root} onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    {p.img && data && <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: m.dx }, { translateY: m.dy }, { rotate: `${m.angleDeg}deg` }, { scale: m.scale }] }]}>
      <Image source={{ uri: p.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>}
    {sim && <FaceFilterOverlay filterId={filterId} face={sim.drawn} width={view.width} height={view.height} live />}
    {truthMarks.map((pt, i) => <View key={i} pointerEvents="none" style={[styles.dot, { left: pt.x - 4, top: pt.y - 4 }]} />)}
    <View style={styles.hud} pointerEvents="none">
      <Text style={styles.hudText}>DEV live-lens feed · {freeze !== null ? `bevroren op t=${t.toFixed(2)} s` : `t=${(t % FEED_PERIOD_S).toFixed(2)} s`}</Text>
      <Text style={styles.hudText}>{mirrored ? 'front (gespiegeld)' : 'achter'} · {aspect.toFixed(2)} · hoek {m.angleDeg.toFixed(1)}° · schaal {m.scale.toFixed(2)} · jitter {jitter}px · {sim ? `${sim.fps.toFixed(1)} fps feed` : '…'}</Text>
      <Text style={styles.hudText}>{inDropout(t) ? (sim?.drawn ? 'detector: geen gezicht → hold' : 'detector: geen gezicht → lens weg') : err !== null ? `afwijking ogen ${(err * 100).toFixed(1)}% oogafstand` : 'zoeken…'}</Text>
      {!!error && <Text style={styles.hudText}>{error}</Text>}
      {!p.lm && <Text style={styles.hudText}>Geef ?img=…&lm=… mee.</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090E', overflow: 'hidden' },
  hud: { position: 'absolute', left: 10, right: 10, bottom: 34, backgroundColor: '#000000B0', borderRadius: 10, padding: 8, gap: 2 },
  hudText: { color: 'white', fontSize: 12, fontWeight: '600' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3CFF6B' },
});
