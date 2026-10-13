import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);
const { lensAnchors, wingLayout, wingPoints } = await import('./face-filters/anchors.ts');
const { mapFaceGeometry, placeholderFace, stickerMatrix } = await import('./face-filters/geometry.ts');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
/** Opens the jaw: lower lip + chin part of the oval move down by `gap` (view units). */
function openMouth(face, gap) {
  const c = face.contours;
  const my = (c.UPPER_LIP_TOP.reduce((s, p) => s + p.y, 0) / c.UPPER_LIP_TOP.length);
  const down = (pts) => pts.map((p) => (p.y > my ? { x: p.x, y: p.y + gap } : p));
  return { ...face, contours: { ...c, LOWER_LIP_BOTTOM: c.LOWER_LIP_BOTTOM.map((p) => ({ x: p.x, y: p.y + gap })), LOWER_LIP_TOP: (c.LOWER_LIP_TOP ?? c.LOWER_LIP_BOTTOM).map((p) => ({ x: p.x, y: p.y + gap })),
    UPPER_LIP_BOTTOM: c.UPPER_LIP_BOTTOM ?? c.UPPER_LIP_TOP, FACE: down(c.FACE) } };
}

test('head-attached anchors do not move or stretch when the mouth opens', () => {
  const { face } = placeholderFace(390, 840);
  const a = lensAnchors(face), b = lensAnchors(openMouth(face, 40));
  a.matrix.forEach((v, i) => near(v, b.matrix[i], 1e-9));
  near(a.top.y, b.top.y, 1e-9);
  assert.ok(b.mouthGap > a.mouthGap + 0.3, 'mouth gap grows');
  assert.ok(b.mouth.y > a.mouth.y, 'mouth anchor follows the jaw');
});

test('stickerMatrix keeps proportions when the mouth opens (no vertical stretch)', () => {
  const { face } = placeholderFace(390, 840);
  const anchors = [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }];
  const m1 = stickerMatrix(face, anchors), m2 = stickerMatrix(openMouth(face, 60), anchors);
  m1.forEach((v, i) => near(v, m2[i], 1e-9));
  // similarity: equal column lengths (no stretch), orthogonal columns
  near(Math.hypot(m1[0], m1[1]), Math.hypot(m1[2], m1[3]), 1e-9);
});

test('wings stay on screen on a close-up selfie and keep full size at normal distance', () => {
  const view = { width: 393, height: 852 };
  const check = (face, minInside) => {
    for (const w of wingLayout(face, view)) {
      const q = wingPoints(w);
      const frac = q.filter((p) => p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height).length / q.length;
      assert.ok(frac >= minInside, `${Math.round(frac * 100)}% of the wing on screen`);
      const ys = q.map((p) => p.y);
      assert.ok(Math.max(...ys) - Math.min(...ys) > view.height * 0.1, 'wing is clearly visible (not shrunk to nothing)');
    }
  };
  const { face } = placeholderFace(view.width * 0.55, view.height * 0.55);
  const normal = mapFaceGeometry(face, (p) => ({ x: p.x + view.width * 0.225, y: p.y + view.height * 0.2 }));
  check(normal, 0.99);
  const dNormal = lensAnchors(normal).frame.eyeDist;
  wingLayout(normal, view).forEach((w) => assert.ok(w.scale > dNormal * 0.7, 'normal distance keeps big wings'));
  const { face: big } = placeholderFace(view.width * 1.6, view.height * 1.2);
  const close = mapFaceGeometry(big, (p) => ({ x: p.x - view.width * 0.3, y: p.y - view.height * 0.1 }));
  check(close, 0.8);
});
