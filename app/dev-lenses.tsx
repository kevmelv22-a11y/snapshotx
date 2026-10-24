import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { FaceFilterOverlay } from '../components/FaceFilterOverlay';
import { LensTilePreview } from '../components/LensTilePreview';
import { ExpressionTracker, NEUTRAL_EXPRESSION, TRIGGER_HINTS, effectActive, eyeOpenness, mouthOpenRatio, smileScore, type ExpressionState } from '../lib/face-filters/expressions';
import { coverTransform, mapFaceGeometry, placeholderFace } from '../lib/face-filters/geometry';
import type { FaceGeometry, Pt } from '../lib/face-filters/types';
import { lensTrigger, worldKind } from '../lib/lens-effects';
import { PHOTO_FILTERS, isPhotoFilterId, photoFilter, type PhotoFilterId } from '../lib/photo-filters';

type Expr = { mouth: number; eyes: number; smile: number };
const NEUTRAL: Expr = { mouth: 0, eyes: 1, smile: 0.05 };

/** Synthetic face with inner lips (gap in eye distances), eye contours (openness) and a smile probability. */
function syntheticFace(w: number, h: number, e: Expr): { face: FaceGeometry; head: { cx: number; cy: number; rx: number; ry: number } } {
  const { face, head } = placeholderFace(w, h);
  const c = face.contours!;
  const eyeC = (pts: Pt[]) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });
  const L = eyeC(c.LEFT_EYE!), R = eyeC(c.RIGHT_EYE!), d = Math.abs(L.x - R.x);
  const ring = (o: Pt, a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return { x: o.x + a * Math.cos(t), y: o.y + b * Math.sin(t) }; });
  const eyeB = Math.max(0.6, head.rx * 0.085 * e.eyes);
  const my = head.cy + head.ry * 0.48, mw = head.rx * 0.32 * (1 + 0.35 * e.smile), gap = e.mouth * d;
  const arc = (y: number, bow: number, n: number, k = 0.85) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return { x: head.cx - mw * k + 2 * mw * k * u, y: y + bow * Math.sin(Math.PI * u) }; });
  return { head, face: { ...face, contours: { ...c,
    LEFT_EYE: ring(L, head.rx * 0.2, eyeB, 16), RIGHT_EYE: ring(R, head.rx * 0.2, eyeB, 16),
    UPPER_LIP_TOP: arc(my - head.rx * 0.08, -head.rx * 0.03, 11, 1), UPPER_LIP_BOTTOM: arc(my - gap / 2, 0, 9),
    LOWER_LIP_TOP: arc(my + gap / 2, gap * 0.3, 9), LOWER_LIP_BOTTOM: arc(my + head.rx * 0.08 + gap, head.rx * 0.04, 11, 1) },
    leftEyeOpenProbability: e.eyes, rightEyeOpenProbability: e.eyes, smilingProbability: e.smile } };
}

function DrawnFace({ w, h, face, head, e }: { w: number; h: number; face: FaceGeometry; head: { cx: number; cy: number; rx: number; ry: number }; e: Expr }) {
  const { cx, cy, rx, ry } = head; const c = face.contours!;
  const pts = (p: Pt[]) => p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('') + 'Z';
  const mouthOuter = [...c.UPPER_LIP_TOP!, ...[...c.LOWER_LIP_BOTTOM!].reverse()];
  const inner = [...c.UPPER_LIP_BOTTOM!, ...[...c.LOWER_LIP_TOP!].reverse()];
  return <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
    <Rect width={w} height={h} fill="#4A4F63" />
    <Ellipse cx={cx} cy={h * 1.02} rx={w * 0.5} ry={h * 0.24} fill="#3E5C82" />
    <Rect x={cx - rx * 0.4} y={cy + ry * 0.6} width={rx * 0.8} height={ry * 0.75} fill="#C88E6E" />
    <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#E3AC88" />
    <Path d={`M${cx - rx * 1.02} ${cy - ry * 0.12} Q${cx - rx * 1.05} ${cy - ry * 1.12} ${cx} ${cy - ry * 1.08} Q${cx + rx * 1.05} ${cy - ry * 1.12} ${cx + rx * 1.02} ${cy - ry * 0.12} Q${cx + rx * 0.7} ${cy - ry * 0.62} ${cx} ${cy - ry * 0.66} Q${cx - rx * 0.7} ${cy - ry * 0.62} ${cx - rx * 1.02} ${cy - ry * 0.12} Z`} fill="#2B1D16" />
    {[c.LEFT_EYE!, c.RIGHT_EYE!].map((p, i) => <Path key={i} d={pts(p)} fill={e.eyes > 0.3 ? '#F4EEE8' : '#B97D5F'} stroke="#3A2618" strokeWidth={2} />)}
    {e.eyes > 0.3 && [c.LEFT_EYE!, c.RIGHT_EYE!].map((p, i) => { const x = p.reduce((a, q) => a + q.x, 0) / p.length, y = p.reduce((a, q) => a + q.y, 0) / p.length; return <Ellipse key={`p${i}`} cx={x} cy={y} rx={rx * 0.07} ry={rx * 0.07} fill="#3B2A22" />; })}
    <Path d={pts(mouthOuter)} fill="#B5535C" />
    {e.mouth > 0.05 && <Path d={pts(inner)} fill="#3A0F14" />}
  </Svg>;
}

/**
 * DEV-ONLY (redirects in release builds). Lens test bench with fake face data:
 *  ?grid=1                          tiles of the new lenses (as in the picker)
 *  ?filter=<id>&expr=mouth|smile|blink&phase=before|after   runs the real ExpressionTracker over a
 *                                   neutral → expression sequence and draws the overlay at the end
 *  ?photo=<name>&filter=<id>[&burst=1][&base=url][&hud=0]  real photo + MediaPipe landmarks <base>/<name>.jpg|.json
 *  ?filter=confetti|snow|heartRain&t=<s>  world lens over a drawn rear-camera street scene (no face)
 */
/** Real photo + MediaPipe landmarks (local test server), see `?photo=`. */
type PhotoData = { image: { width: number; height: number }; face: FaceGeometry | null; uri: string };

function PhotoBench({ name, filterId, burst, tS, base, hud }: { name: string; filterId: PhotoFilterId; burst: boolean; tS: number; base: string; hud: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [data, setData] = useState<PhotoData | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let on = true;
    fetch(`${base}/${name}.json`).then((r) => r.json()).then((j: Omit<PhotoData, 'uri'>) => { if (on) setData({ ...j, uri: `${base}/${name}.jpg` }); }).catch((e: unknown) => setErr(String(e)));
    return () => { on = false; };
  }, [name, base]);
  const view = useMemo(() => {
    if (!data?.face || size.width <= 0) return null;
    const face = mapFaceGeometry(data.face, coverTransform(data.image, size));
    // Run the real ExpressionTracker on the real landmarks (10 frames ≈ 330 ms).
    const tracker = new ExpressionTracker();
    let st: ExpressionState = NEUTRAL_EXPRESSION, t = 0;
    for (; t <= 330; t += 33) st = tracker.update(face, t);
    // A still photo cannot blink: for blink lenses optionally inject a burst 300 ms old.
    if (burst) st = { ...st, lastRise: { ...st.lastRise, blink: t - 300 } };
    return { face, st, t };
  }, [data, size, burst]);
  const world = worldKind(filterId), tr = lensTrigger(filterId);
  const tint = photoFilter(filterId).tint;
  return <View style={styles.root} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    {data && <Image source={{ uri: data.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
    {tint && tint !== 'transparent' && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />}
    {size.width > 0 && (world || view) && <FaceFilterOverlay filterId={filterId} face={world ? null : view!.face} width={size.width} height={size.height}
      expression={view?.st} nowMs={world ? tS * 1000 : view?.t} />}
    {hud && <View style={styles.hud} pointerEvents="none">
      <Text style={styles.hudText}>DEV lens · {photoFilter(filterId).name} · echte foto “{name}” · MediaPipe-landmarks{err ? ` · ${err}` : ''}{data && !data.face ? ' · geen gezicht' : ''}</Text>
      {view && <Text style={styles.hudText}>mond {mouthOpenRatio(view.face)?.toFixed(2)} · ogen {eyeOpenness(view.face)?.toFixed(2)} · lach {smileScore(view.face)?.toFixed(2)} · trigger {tr ?? '—'}: {tr ? (effectActive(tr, view.st, view.t) ? 'AAN' : 'uit') : 'geen'}{burst ? ' (knipper-burst geïnjecteerd)' : ''}</Text>}
    </View>}
  </View>;
}

export default function DevLenses() {
  const p = useLocalSearchParams<{ grid?: string; filter?: string; expr?: string; phase?: string; t?: string; photo?: string; burst?: string; base?: string; hud?: string }>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const filterId: PhotoFilterId = isPhotoFilterId(p.filter) ? p.filter : 'dragon';
  const after = p.phase === 'after';
  const target: Expr = p.expr === 'mouth' ? { ...NEUTRAL, mouth: 0.4 } : p.expr === 'smile' ? { ...NEUTRAL, smile: 0.92 } : p.expr === 'blink' ? { ...NEUTRAL, eyes: 0.03 } : NEUTRAL;
  const shown = after ? target : NEUTRAL;
  const sim = useMemo(() => {
    if (size.width <= 0) return null;
    const tracker = new ExpressionTracker();
    let st: ExpressionState = NEUTRAL_EXPRESSION, t = 0;
    for (; t <= 1000; t += 33) st = tracker.update(syntheticFace(size.width, size.height, NEUTRAL).face, t);
    // Blink: eyes close for 2 frames and reopen, then render 300 ms into the burst.
    if (after) {
      const frames = p.expr === 'blink' ? 2 : 10;
      for (let i = 0; i < frames; i++, t += 33) st = tracker.update(syntheticFace(size.width, size.height, target).face, t);
      if (p.expr === 'blink') for (; t < (st.lastRise.blink ?? 0) + 300; t += 33) st = tracker.update(syntheticFace(size.width, size.height, NEUTRAL).face, t);
    }
    return { st, t, ...syntheticFace(size.width, size.height, p.expr === 'blink' ? NEUTRAL : shown) };
  }, [size, after, p.expr]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!__DEV__) return <Redirect href="/" />;
  if (p.photo) return <PhotoBench name={p.photo} filterId={filterId} burst={p.burst === '1'} tS={Number(p.t ?? 1.2)} base={p.base ?? 'http://localhost:8097'} hud={p.hud !== '0'} />;
  if (p.grid === '1') {
    const ids: PhotoFilterId[] = ['dragon', 'rainbow', 'blush', 'sparkle', 'clown', 'devil', 'halo', 'confetti', 'snow', 'heartRain'];
    return <ScrollView style={styles.root} contentContainerStyle={styles.grid}>
      <Text style={styles.title}>DEV · nieuwe lenzen (tegels zoals in de lenskiezer)</Text>
      {ids.map((id) => <View key={id} style={styles.cell}><LensTilePreview lens={photoFilter(id)} width={110} height={170} />
        <Text style={styles.cap}>{photoFilter(id).name}{lensTrigger(id) ? ` · ${TRIGGER_HINTS[lensTrigger(id)!]}` : worldKind(id) ? ' · wereld' : ''}</Text></View>)}
    </ScrollView>;
  }
  const world = worldKind(filterId);
  const tS = Number(p.t ?? 1.2);
  return <View style={styles.root} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    {world ? <>
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
        <Rect width={size.width} height={size.height * 0.55} fill="#7FA7D9" />
        <Rect y={size.height * 0.25} x={size.width * 0.05} width={size.width * 0.3} height={size.height * 0.4} fill="#8C6D5A" />
        <Rect y={size.height * 0.18} x={size.width * 0.55} width={size.width * 0.38} height={size.height * 0.47} fill="#A3A9B5" />
        <Rect y={size.height * 0.55} width={size.width} height={size.height * 0.45} fill="#55585F" />
        <Rect y={size.height * 0.75} x={size.width * 0.45} width={size.width * 0.1} height={size.height * 0.05} fill="#E9E9E9" />
      </Svg>
      {photoFilter(filterId).tint !== 'transparent' && <View style={[StyleSheet.absoluteFill, { backgroundColor: photoFilter(filterId).tint }]} />}
      <FaceFilterOverlay filterId={filterId} face={null} width={size.width} height={size.height} nowMs={tS * 1000} live />
    </> : sim && <>
      <DrawnFace w={size.width} h={size.height} face={sim.face} head={sim.head} e={p.expr === 'blink' ? NEUTRAL : shown} />
      <FaceFilterOverlay filterId={filterId} face={sim.face} width={size.width} height={size.height} live expression={sim.st} nowMs={sim.t} />
    </>}
    <View style={styles.hud} pointerEvents="none">
      <Text style={styles.hudText}>DEV lens · {photoFilter(filterId).name} · {world ? `wereldlens, achtercamera, geen gezicht · t=${tS.toFixed(2)} s` : `${after ? 'NA' : 'VOOR'} ${p.expr ?? 'neutraal'}`}</Text>
      {sim && !world && (() => { const f = syntheticFace(size.width, size.height, shown).face; const tr = lensTrigger(filterId); return <>
        <Text style={styles.hudText}>mond {mouthOpenRatio(f)?.toFixed(2)} · ogen {eyeOpenness(f)?.toFixed(2)} · lach {smileScore(f)?.toFixed(2)}</Text>
        <Text style={styles.hudText}>trigger {tr ?? '—'}: {tr ? (effectActive(tr, sim.st, sim.t) ? 'AAN' : `uit (${TRIGGER_HINTS[tr]})`) : 'geen'} · teller mond {sim.st.count.mouthOpen} / lach {sim.st.count.smile} / knipper {sim.st.count.blink}</Text>
      </>; })()}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090E', overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10 },
  title: { color: 'white', fontWeight: '700', width: '100%', marginBottom: 4 },
  cell: { width: 110, gap: 4 },
  cap: { color: 'white', fontSize: 11 },
  hud: { position: 'absolute', left: 10, right: 10, bottom: 34, backgroundColor: '#000000B0', borderRadius: 10, padding: 8, gap: 2 },
  hudText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
