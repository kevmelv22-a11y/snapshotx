import assert from 'node:assert/strict';
import test from 'node:test';
import { affineFromTriangles, balaclavaShape, coverTransform, faceFrame, mapFaceGeometry, placeholderFace, polygonRadius } from './face-filters/geometry.ts';
import { faceFromDetector, largestFace } from './face-filters/fromDetector.ts';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const rotate = (p, c, deg) => { const r = (deg * Math.PI) / 180; const dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) }; };
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

test('coverTransform matches cover crop and mirrors when asked', () => {
  const t = coverTransform({ width: 1000, height: 500 }, { width: 500, height: 500 });
  assert.deepEqual(t({ x: 350, y: 100 }), { x: 100, y: 100 });
  const m = coverTransform({ width: 1000, height: 500 }, { width: 500, height: 500 }, true);
  assert.deepEqual(m({ x: 350, y: 100 }), { x: 400, y: 100 });
});

test('affineFromTriangles maps the three anchors exactly', () => {
  const src = [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }];
  const dst = [{ x: 10, y: 20 }, { x: 90, y: 40 }, { x: 40, y: 130 }];
  const [a, b, c, d, e, f] = affineFromTriangles(src, dst);
  src.forEach((p, i) => { near(a * p.x + c * p.y + e, dst[i].x); near(b * p.x + d * p.y + f, dst[i].y); });
});

test('faceFrame follows head roll; balaclava holes sit on the eyes and the mouth', () => {
  const { face } = placeholderFace(300, 450);
  for (const deg of [0, 20, -25]) {
    const c = { x: 150, y: 200 };
    const rotated = mapFaceGeometry(face, (p) => rotate(p, c, deg));
    const f = faceFrame(rotated);
    near((f.roll * 180) / Math.PI, deg, 1e-6);
    const s = balaclavaShape(rotated);
    const eyeCenters = [rotated.contours.LEFT_EYE, rotated.contours.RIGHT_EYE].map((pts) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length }));
    for (const e of eyeCenters) assert.ok(s.eyes.some((h) => inside(e, h.points)), `eye centre inside a hole at ${deg}deg`);
    // every eye contour point is uncovered (inside its hole)
    for (const pts of [rotated.contours.LEFT_EYE, rotated.contours.RIGHT_EYE]) for (const p of pts) assert.ok(s.eyes.some((h) => inside(p, h.points)));
    for (const p of [...rotated.contours.UPPER_LIP_TOP, ...rotated.contours.LOWER_LIP_BOTTOM]) assert.ok(inside(p, s.mouth.points), 'lips inside mouth hole');
    // the whole face oval is covered by the head outline
    for (const p of rotated.contours.FACE) assert.ok(inside(p, s.outline), 'face oval covered');
    // holes are inside the head
    for (const h of [...s.eyes, s.mouth]) assert.ok(inside(h.center, s.outline));
  }
});

test('balaclava falls back to landmarks/bounds when contours are missing', () => {
  const face = { bounds: { x: 100, y: 100, width: 200, height: 260 }, landmarks: { LEFT_EYE: { x: 240, y: 200 }, RIGHT_EYE: { x: 160, y: 200 }, MOUTH_LEFT: { x: 170, y: 290 }, MOUTH_RIGHT: { x: 230, y: 290 } } };
  const s = balaclavaShape(face);
  assert.ok(s.d.includes('Z'));
  assert.ok(inside({ x: 160, y: 200 }, s.eyes[0].points));
  assert.ok(inside({ x: 240, y: 200 }, s.eyes[1].points));
  assert.ok(inside({ x: 200, y: 290 }, s.mouth.points));
});

test('polygonRadius of a square', () => {
  const sq = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }];
  near(polygonRadius(sq, 0), 1);
  near(polygonRadius(sq, Math.PI / 4), Math.SQRT2);
});

test('faceFromDetector copies plain data and largestFace picks the biggest', () => {
  const f = faceFromDetector({ bounds: { x: 1, y: 2, width: 3, height: 4 }, contours: { FACE: [{ x: 1, y: 1 }, { x: NaN, y: 0 }] }, landmarks: { NOSE_BASE: { x: 5, y: 6 } }, rollAngle: 3 });
  assert.deepEqual(f.contours.FACE, [{ x: 1, y: 1 }]);
  assert.deepEqual(f.landmarks.NOSE_BASE, { x: 5, y: 6 });
  assert.equal(largestFace([{ bounds: { width: 1, height: 1 } }, { bounds: { width: 3, height: 2 } }]).bounds.width, 3);
  assert.equal(largestFace([]), null);
});
