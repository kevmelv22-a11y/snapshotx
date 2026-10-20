import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);
const X = await import('./face-filters/expressions.ts');
const W = await import('./face-filters/worldEffects.ts');
const { LENS_TRIGGERS, WORLD_LENSES, lensTrigger, isWorldLens } = await import('./lens-effects.ts');
const { PHOTO_FILTERS } = await import('./photo-filters.ts');
const { lensesForTab, pickerLenses, searchLenses } = await import('./lens-picker.ts');
const { fromDetectorTest } = { fromDetectorTest: await import('./face-filters/fromDetector.ts') };

/** Synthetic upright face: eyes 100 px apart; `gap` = inner-lip opening in px, `eye` = eye contour half-height. */
const ring = (cx, cy, a, b, n) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return { x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) }; });
const line = (x0, x1, y, n, bow = 0) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return { x: x0 + (x1 - x0) * u, y: y + bow * Math.sin(Math.PI * u) }; });
function face({ gap = 2, eye = 12, mouthW = 90, probs = {} } = {}) {
  const my = 230;
  return {
    bounds: { x: 50, y: 60, width: 200, height: 260 },
    contours: {
      LEFT_EYE: ring(100, 150, 20, eye, 16), RIGHT_EYE: ring(200, 150, 20, eye, 16),
      UPPER_LIP_TOP: line(150 - mouthW / 2, 150 + mouthW / 2, my - 10, 11, -4),
      UPPER_LIP_BOTTOM: line(150 - mouthW / 2 + 5, 150 + mouthW / 2 - 5, my - gap / 2, 9),
      LOWER_LIP_TOP: line(150 - mouthW / 2 + 5, 150 + mouthW / 2 - 5, my + gap / 2, 9),
      LOWER_LIP_BOTTOM: line(150 - mouthW / 2, 150 + mouthW / 2, my + 12 + gap, 11, 4),
    },
    ...probs,
  };
}
const rotate = (f, deg) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); const m = (p) => ({ x: 150 + (p.x - 150) * c - (p.y - 150) * s, y: 150 + (p.x - 150) * s + (p.y - 150) * c }); const out = { ...f, contours: {} }; for (const [k, v] of Object.entries(f.contours)) out.contours[k] = v.map(m); return out; };

test('mouthOpenRatio: closed ≈ 0, grows with the lip gap, independent of roll and scale', () => {
  assert.ok(X.mouthOpenRatio(face({ gap: 2 })) < 0.05);
  assert.ok(Math.abs(X.mouthOpenRatio(face({ gap: 40 })) - 0.4) < 0.05);
  assert.ok(Math.abs(X.mouthOpenRatio(rotate(face({ gap: 40 }), 25)) - X.mouthOpenRatio(face({ gap: 40 }))) < 1e-6);
  assert.ok(X.mouthOpenRatio(face({ gap: 10 })) < X.mouthOpenRatio(face({ gap: 30 })));
  assert.equal(X.mouthOpenRatio({ bounds: { x: 0, y: 0, width: 10, height: 10 } }), undefined);
});

test('eyeOpenness: ML Kit probabilities first (max of both eyes), contour aspect as fallback', () => {
  assert.equal(X.eyeOpenness(face({ probs: { leftEyeOpenProbability: 0.1, rightEyeOpenProbability: 0.8 } })), 0.8);
  assert.ok(X.eyeOpenness(face({ eye: 12 })) > 0.9);
  assert.ok(X.eyeOpenness(face({ eye: 1.5 })) < 0.1);
});

test('smileScore: probability when present, mouth width fallback otherwise', () => {
  assert.equal(X.smileScore(face({ probs: { smilingProbability: 0.93 } })), 0.93);
  assert.ok(X.smileScore(face({ mouthW: 85 })) < 0.1);
  assert.ok(X.smileScore(face({ mouthW: 130 })) > 0.9);
});

test('HysteresisTrigger: dead band suppresses flicker, debounce needs the value to hold', () => {
  const t = new X.HysteresisTrigger({ on: 0.5, off: 0.3, minOnMs: 50, minOffMs: 0 });
  assert.deepEqual(t.update(0.6, 0), { active: false, rose: false, fell: false }); // pending
  assert.deepEqual(t.update(0.6, 30), { active: false, rose: false, fell: false });
  assert.deepEqual(t.update(0.6, 60), { active: true, rose: true, fell: false });
  // Noise between off and on keeps it on and never re-fires.
  for (let i = 0; i < 20; i++) assert.deepEqual(t.update(i % 2 ? 0.45 : 0.32, 70 + i * 10), { active: true, rose: false, fell: false });
  assert.deepEqual(t.update(0.29, 300), { active: false, rose: false, fell: true });
  assert.deepEqual(t.update(0.49, 310), { active: false, rose: false, fell: false });
  // A spike shorter than minOnMs does not trigger.
  t.update(0.9, 400); assert.equal(t.update(0.1, 420).active, false); assert.equal(t.update(0.9, 430).active, false); assert.equal(t.update(0.9, 470).active, false); assert.equal(t.update(0.9, 480).rose, true);
  // Missing measurement keeps the state.
  assert.equal(t.update(undefined, 500).active, true);
});

test('HysteresisTrigger invert (blink) and invalid thresholds', () => {
  const b = new X.HysteresisTrigger({ on: 0.25, off: 0.5, minOnMs: 0, minOffMs: 0, invert: true });
  assert.equal(b.update(0.9, 0).active, false);
  assert.equal(b.update(0.1, 10).rose, true);
  assert.equal(b.update(0.4, 20).active, true);
  assert.equal(b.update(0.6, 30).fell, true);
  assert.throws(() => new X.HysteresisTrigger({ on: 0.3, off: 0.5, minOnMs: 0, minOffMs: 0 }));
  assert.throws(() => new X.HysteresisTrigger({ on: 0.5, off: 0.3, minOnMs: 0, minOffMs: 0, invert: true }));
});

test('ExpressionTracker: open mouth fires once per opening, noisy jaw does not flicker, face loss releases', () => {
  const tr = new X.ExpressionTracker();
  let t = 0, s;
  for (; t < 300; t += 33) s = tr.update(face({ gap: 2 }), t);
  assert.equal(s.active.mouthOpen, false);
  // Opening with jitter around 0.17–0.32 of eye distance (in-between values stay inside the band).
  const gaps = [30, 32, 28, 31, 18, 29, 33, 20, 30];
  for (const g of gaps) { s = tr.update(face({ gap: g }), t); t += 33; }
  assert.equal(s.active.mouthOpen, true);
  assert.equal(s.count.mouthOpen, 1);
  for (let i = 0; i < 6; i++) { s = tr.update(face({ gap: 2 }), t); t += 33; }
  assert.equal(s.active.mouthOpen, false);
  for (let i = 0; i < 4; i++) { s = tr.update(face({ gap: 35 }), t); t += 33; }
  assert.equal(s.count.mouthOpen, 2);
  s = tr.update(null, t);
  assert.equal(s.active.mouthOpen, false);
  assert.equal(s.count.mouthOpen, 2);
});

test('ExpressionTracker: blink burst lasts BURST_MS, smile via probability', () => {
  const tr = new X.ExpressionTracker();
  const open = { leftEyeOpenProbability: 0.95, rightEyeOpenProbability: 0.97 };
  const closed = { leftEyeOpenProbability: 0.05, rightEyeOpenProbability: 0.1 };
  tr.update(face({ probs: open }), 0);
  const s = tr.update(face({ probs: closed }), 33);
  assert.equal(s.lastRise.blink, 33);
  assert.equal(X.effectActive('blink', s, 33 + X.BURST_MS - 1), true);
  assert.equal(X.effectActive('blink', s, 33 + X.BURST_MS), false);
  assert.ok(Math.abs(X.effectAgeS('blink', s, 433) - 0.4) < 1e-9);
  // One eye closed (wink) is not a blink.
  const tr2 = new X.ExpressionTracker();
  tr2.update(face({ probs: open }), 0);
  assert.equal(tr2.update(face({ probs: { leftEyeOpenProbability: 0.05, rightEyeOpenProbability: 0.9 } }), 33).count.blink, 0);
  let st;
  for (let t = 0; t <= 200; t += 33) st = tr2.update(face({ probs: { ...open, smilingProbability: 0.9 } }), t + 100);
  assert.equal(st.active.smile, true);
  assert.equal(X.effectActive('smile', st, 0), true);
});

test('worldParticles: deterministic, inside the view horizontally (plus sway), wrap vertically and move over time', () => {
  const view = { width: 393, height: 852 };
  for (const k of ['confetti', 'snow', 'hearts']) {
    const a = W.worldParticles(k, 1.5, view), b = W.worldParticles(k, 1.5, view), c = W.worldParticles(k, 1.6, view);
    assert.deepEqual(a, b);
    assert.ok(a.length >= 18);
    assert.ok(a.every((p) => p.x > -40 && p.x < view.width + 40 && p.y >= -60 && p.y <= view.height + 60));
    assert.ok(a.some((p, i) => p.y !== c[i].y));
  }
  assert.deepEqual(W.worldParticles('snow', 1, { width: 0, height: 10 }), []);
  assert.ok(W.worldParticles('confetti', 0, { width: 80, height: 120 }).length < W.worldParticles('confetti', 0, view).length);
});

test('burstParticles: spreads out from the origin, fades, ends after BURST_LIFE_S', () => {
  const o = { x: 100, y: 100 };
  const early = W.burstParticles(o, 0.05, 50, 1), late = W.burstParticles(o, 0.6, 50, 1);
  const spread = (ps) => Math.max(...ps.map((p) => Math.hypot(p.x - o.x, p.y - o.y)));
  assert.ok(spread(late) > spread(early));
  assert.ok(late[0].opacity < early[0].opacity);
  assert.deepEqual(W.burstParticles(o, W.BURST_LIFE_S, 50, 1), []);
  assert.deepEqual(W.burstParticles(o, -0.1, 50, 1), []);
});

test('lens catalogue: triggers and world lenses refer to real lenses; picker shows them', () => {
  const ids = PHOTO_FILTERS.map((f) => f.id);
  for (const id of [...Object.keys(LENS_TRIGGERS), ...Object.keys(WORLD_LENSES)]) assert.ok(ids.includes(id), id);
  for (const id of Object.keys(WORLD_LENSES)) assert.equal(PHOTO_FILTERS.find((f) => f.id === id).kind, 'world');
  for (const id of Object.keys(LENS_TRIGGERS)) assert.equal(PHOTO_FILTERS.find((f) => f.id === id).kind, 'face');
  assert.equal(lensTrigger('dragon'), 'mouthOpen'); assert.equal(lensTrigger('dog'), undefined);
  assert.ok(isWorldLens('snow')); assert.ok(!isWorldLens('cat'));
  const L = pickerLenses(PHOTO_FILTERS);
  assert.deepEqual(lensesForTab('world', L, { favorites: [], recent: [] }).map((l) => l.id).sort(), ['confetti', 'heartRain', 'snow']);
  assert.ok(lensesForTab('looks', L, { favorites: [], recent: [] }).length >= 13);
  assert.deepEqual(searchLenses('mond open', L).map((l) => l.id).sort(), ['dragon', 'rainbow']);
  assert.equal(new Set(ids).size, ids.length);
});

test('faceFromDetector keeps valid classification probabilities and drops ML Kit -1', () => {
  const f = fromDetectorTest.faceFromDetector({ bounds: { x: 0, y: 0, width: 1, height: 1 }, smilingProbability: 0.8, leftEyeOpenProbability: -1, rightEyeOpenProbability: 0.4 });
  assert.equal(f.smilingProbability, 0.8); assert.equal(f.leftEyeOpenProbability, undefined); assert.equal(f.rightEyeOpenProbability, 0.4);
});
