import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';

// The live pipeline modules import each other without extensions (Metro style); resolve those to .ts.
register('./ts-resolve-hook.mjs', import.meta.url);
const { affineFromConverter, affineFromSamples, applyAffine, composeAffine, invertAffine, modelCameraToView } = await import('./face-filters/cameraMapping.ts');
const { balaclavaShape, centroid, faceFrame, mapFaceGeometry, placeholderFace } = await import('./face-filters/geometry.ts');
const { FaceSmoother, OneEuro } = await import('./face-filters/smoothing.ts');
const { DEFAULT_LIVE, LiveFaceTracker } = await import('./face-filters/liveTracker.ts');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
const nearPt = (p, q, eps = 1e-6) => { near(p.x, q.x, eps); near(p.y, q.y, eps); };
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const VIEW = { width: 393, height: 852 };

test('affineFromSamples recovers rotation, mirroring and aspect-fill crop exactly', () => {
  for (const mirrored of [false, true]) for (const sensorAspect of [16 / 9, 4 / 3]) {
    const m = modelCameraToView({ mirrored, sensorAspect, view: VIEW });
    const conv = { convertCameraPointToViewPoint: (p) => applyAffine(m, p) };
    const got = affineFromConverter(conv);
    for (const p of [{ x: 0.13, y: 0.77 }, { x: 0.5, y: 0.5 }, { x: 0.91, y: 0.02 }]) nearPt(applyAffine(got, p), applyAffine(m, p), 1e-9);
  }
  // Any affine map (here: 270° rotation + scale + offset) is reproduced from three samples.
  const m = { a: 0, b: -300, c: 520, d: 0, tx: -40, ty: 700 };
  const s = affineFromSamples(applyAffine(m, { x: 0, y: 0 }), applyAffine(m, { x: 1, y: 0 }), applyAffine(m, { x: 0, y: 1 }));
  assert.deepEqual(s, m);
  nearPt(applyAffine(composeAffine(invertAffine(m), m), { x: 0.3, y: 0.6 }), { x: 0.3, y: 0.6 }, 1e-12);
  assert.throws(() => affineFromConverter({ convertCameraPointToViewPoint: () => ({ x: NaN, y: 0 }) }));
});

test('portrait model: back camera rotates 90°, front camera is mirrored, 16:9 is centre-cropped', () => {
  const back = modelCameraToView({ mirrored: false, sensorAspect: 16 / 9, view: VIEW });
  const front = modelCameraToView({ mirrored: true, sensorAspect: 16 / 9, view: VIEW });
  // 16:9 content in a 393×852 view: height limited → 852 tall, 479.25 wide, 43.125 cropped per side.
  nearPt(applyAffine(back, { x: 0.5, y: 0.5 }), { x: 196.5, y: 426 });
  nearPt(applyAffine(back, { x: 0, y: 0 }), { x: 479.25 - 43.125, y: 0 }); // sensor top-left → upright top-right (cropped)
  nearPt(applyAffine(back, { x: 1, y: 1 }), { x: -43.125, y: 852 });
  nearPt(applyAffine(front, { x: 0, y: 0 }), { x: 393 - (479.25 - 43.125), y: 0 });
  // Mirroring is a pure horizontal flip about the view centre.
  for (const p of [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.6 }]) {
    const a = applyAffine(back, p), b = applyAffine(front, p);
    near(a.x + b.x, VIEW.width); near(a.y, b.y);
  }
});

const sensorFace = (viewFace, model) => {
  const inv = invertAffine(modelCameraToView(model));
  return mapFaceGeometry(viewFace, (p) => applyAffine(inv, p));
};

test('tracker maps detector faces into the preview and the balaclava holes land on the eyes and lips', () => {
  for (const mirrored of [false, true]) {
    const model = { mirrored, sensorAspect: 16 / 9, view: VIEW };
    const truth = placeholderFace(VIEW.width, VIEW.height).face;
    const tracker = new LiveFaceTracker();
    const out = tracker.push([sensorFace(truth, model)], modelCameraToView(model), 0);
    assert.equal(out.kind, 'face');
    nearPt(centroid(out.face.contours.LEFT_EYE), centroid(truth.contours.LEFT_EYE), 1e-6);
    const shape = balaclavaShape(out.face);
    const eyes = [centroid(truth.contours.LEFT_EYE), centroid(truth.contours.RIGHT_EYE)];
    for (const e of eyes) assert.ok(shape.eyes.some((h) => inside(e, h.points)), 'eye inside a hole');
    assert.ok(inside(faceFrame(truth).mouth, shape.mouth.points), 'lips inside the mouth hole');
  }
});

test('tracker throttles to minIntervalMs, picks the largest face and treats a missing mapping as a miss', () => {
  const model = { mirrored: true, sensorAspect: 4 / 3, view: VIEW };
  const big = sensorFace(placeholderFace(VIEW.width, VIEW.height).face, model);
  const small = sensorFace(placeholderFace(VIEW.width / 3, VIEW.height / 3).face, model);
  const t = new LiveFaceTracker({ ...DEFAULT_LIVE, minIntervalMs: 33 });
  const kinds = [0, 10, 20, 33, 40, 70].map((ms) => t.push([small, big], modelCameraToView(model), ms).kind);
  assert.deepEqual(kinds, ['face', 'skip', 'skip', 'face', 'skip', 'face']);
  const r = t.push([small, big], modelCameraToView(model), 200);
  near(r.face.bounds.width, placeholderFace(VIEW.width, VIEW.height).face.bounds.width, 1e-6);
  const held = t.push([big], null, 300); // preview not ready → hold the last face
  assert.ok(held.face);
});

test('One-Euro / FaceSmoother: steadier when still, little lag when moving, hold then drop, reset on jump', () => {
  // Scalar filter: noise on a constant signal is strongly reduced.
  const r = rng(7), f = new OneEuro(1.2, 0.02, 1);
  let inVar = 0, outVar = 0;
  for (let i = 0; i < 300; i++) { const n = gauss(r) * 3; const y = f.filter(100 + n, i * 33); if (i > 30) { inVar += n * n; outVar += (y - 100) ** 2; } }
  assert.ok(outVar < inVar / 5, `scalar noise not reduced enough: ${outVar / inVar}`);

  const base = placeholderFace(VIEW.width, VIEW.height).face;
  const d = faceFrame(base).eyeDist;
  const shift = (dx, dy) => mapFaceGeometry(base, (p) => ({ x: p.x + dx, y: p.y + dy }));
  // Still face + 2 px landmark jitter → eye midpoint jitter drops at least 3×.
  const r2 = rng(11), sm = new FaceSmoother();
  let rawErr = 0, smErr = 0;
  const truth = faceFrame(base).eyeMid;
  for (let i = 0; i < 150; i++) {
    const noisy = mapFaceGeometry(base, (p) => ({ x: p.x + gauss(r2) * 2, y: p.y + gauss(r2) * 2 }));
    const out = sm.update(noisy, i * 33);
    if (i > 20) { rawErr += Math.hypot(faceFrame(noisy).eyeMid.x - truth.x, faceFrame(noisy).eyeMid.y - truth.y) ** 2; smErr += Math.hypot(faceFrame(out).eyeMid.x - truth.x, faceFrame(out).eyeMid.y - truth.y) ** 2; }
  }
  assert.ok(Math.sqrt(smErr / rawErr) < 1 / 3, `jitter ratio ${Math.sqrt(smErr / rawErr)}`);

  // Head moving at 3 eye distances per second: the filter keeps up within ~0.2 eye distance.
  const mv = new FaceSmoother();
  let lag = 0;
  for (let i = 0; i <= 45; i++) { const x = (3 * d * i * 33) / 1000; const out = mv.update(shift(x, 0), i * 33); lag = x - (faceFrame(out).eyeMid.x - truth.x); }
  assert.ok(lag >= 0 && lag < 0.2 * d, `lag ${lag / d} eye distances`);

  // Dropout: held for holdMs (400 ms), then gone; a big jump re-acquires immediately (no sliding).
  const h = new FaceSmoother();
  h.update(base, 0);
  assert.ok(h.update(null, 250));
  assert.equal(h.update(null, 401), null);
  h.update(base, 500);
  const jumped = h.update(shift(3 * d, 0), 533);
  near(faceFrame(jumped).eyeMid.x, truth.x + 3 * d, 1e-6);
});

test('replay of the dev feed (synthetic head movement, jitter, dropouts) through the live pipeline', async () => {
  const { feedFrame, gaussianSource, inDropout, trackingError } = await import('./face-filters/devFeed.ts');
  const model = { mirrored: true, sensorAspect: 16 / 9, view: VIEW };
  const face = placeholderFace(VIEW.width, VIEW.height).face;
  const tracker = new LiveFaceTracker();
  const noise = gaussianSource(42);
  const conv = { convertCameraPointToViewPoint: (p) => applyAffine(modelCameraToView(model), p) };
  let drawn = null, worst = 0, sum = 0, n = 0, heldOk = true, droppedOk = true;
  for (let ms = 0; ms <= 8000; ms += 66) {
    const fr = feedFrame(face, ms / 1000, model, 2, noise);
    const u = tracker.push(fr.faces, affineFromConverter(conv), ms);
    if (u.kind === 'face') drawn = u.face;
    const t = ms / 1000;
    if (t >= 4.0 && t < 4.25 && !drawn) heldOk = false; // short dropout: still drawn (hold)
    if (t >= 6.5 && t < 7.0 && drawn) droppedOk = false; // long dropout: gone after 400 ms
    if (drawn && !inDropout(t) && t > 0.5 && !(t >= 7 && t < 7.5)) { const e = trackingError(drawn, fr.truth); worst = Math.max(worst, e); sum += e; n++; }
  }
  assert.ok(heldOk, 'lens held during the 250 ms dropout');
  assert.ok(droppedOk, 'lens hidden during the long dropout');
  assert.ok(sum / n < 0.06, `mean error ${sum / n} eye distances`);
  assert.ok(worst < 0.2, `worst error ${worst} eye distances`);
});
