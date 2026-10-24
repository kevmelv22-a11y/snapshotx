import assert from 'node:assert/strict';
import test from 'node:test';
import {
  startStroke, extendStroke, undoStroke, strokeToPath, MAX_STROKES,
  addSticker, removeSticker, updateSticker, bringToFront, clampScale, normalizeAngle, pinchOf, applyGesture, isOverTrash, MIN_SCALE, MAX_SCALE,
  nextTextStyle, contrastText, resolveTextStyle, clampUnit, sanitizeText, MAX_TEXT_LENGTH,
  normalizeViewSeconds, timerLabel, timingSummary, snapMessageFields, openDurationMs, TIMER_OPTIONS, DEFAULT_TIMING, EMPTY_EDIT, hasOverlay,
} from './snap-edit.ts';

test('strokes: start, extend, undo one at a time', () => {
  let s = startStroke([], { x: 0, y: 0 }, '#fff', 8);
  s = extendStroke(s, { x: 10, y: 0 });
  s = startStroke(s, { x: 5, y: 5 }, '#f00', 14);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { color: '#fff', width: 8, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
  assert.equal(s[1].color, '#f00');
  const u = undoStroke(s);
  assert.equal(u.length, 1);
  assert.equal(s.length, 2, 'not mutated');
  assert.deepEqual(undoStroke([]), []);
});

test('extendStroke drops jitter and is a no-op without strokes', () => {
  const s = startStroke([], { x: 0, y: 0 }, '#fff', 8);
  assert.equal(extendStroke(s, { x: 0.5, y: 0.5 }), s);
  assert.deepEqual(extendStroke([], { x: 1, y: 1 }), []);
});

test('startStroke caps history', () => {
  let s = [];
  for (let i = 0; i < MAX_STROKES + 5; i++) s = startStroke(s, { x: i, y: 0 }, '#fff', 4);
  assert.equal(s.length, MAX_STROKES);
  assert.equal(s[0].points[0].x, 5);
});

test('strokeToPath builds SVG and keeps single taps visible', () => {
  assert.equal(strokeToPath([]), '');
  assert.equal(strokeToPath([{ x: 1, y: 2 }, { x: 3.14159, y: 4 }]), 'M 1 2 L 3.1 4');
  assert.equal(strokeToPath([{ x: 1, y: 2 }]), 'M 1 2 L 1.1 2');
});

test('stickers: add, update, front, remove', () => {
  let l = addSticker([], '🔥', 'a', { x: 10, y: 20 });
  l = addSticker(l, '⭐', 'b', { x: 0, y: 0 });
  assert.deepEqual(l[0], { id: 'a', emoji: '🔥', x: 10, y: 20, scale: 1, rotation: 0 });
  l = updateSticker(l, 'a', { scale: 2 });
  assert.equal(l[0].scale, 2);
  assert.deepEqual(bringToFront(l, 'a').map((s) => s.id), ['b', 'a']);
  assert.equal(bringToFront(l, 'zzz'), l);
  assert.deepEqual(removeSticker(l, 'a').map((s) => s.id), ['b']);
});

test('clampScale and normalizeAngle', () => {
  assert.equal(clampScale(0.01), MIN_SCALE);
  assert.equal(clampScale(99), MAX_SCALE);
  assert.equal(clampScale(NaN), 1);
  assert.ok(Math.abs(normalizeAngle(3 * Math.PI) - Math.PI) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(-3 * Math.PI / 2) - Math.PI / 2) < 1e-9);
  assert.equal(normalizeAngle(0.5), 0.5);
});

test('applyGesture: one-finger drag translates only', () => {
  const start = { x: 100, y: 100, scale: 1.5, rotation: 0.2 };
  assert.deepEqual(applyGesture(start, { x: 0, y: 0 }, { x: 30, y: -10 }), { x: 130, y: 90, scale: 1.5, rotation: 0.2 });
});

test('applyGesture: pinch scales, rotates and follows the midpoint', () => {
  const start = { x: 100, y: 100, scale: 1, rotation: 0 };
  const from = pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 });
  const to = pinchOf({ x: 10, y: 10 }, { x: 10, y: 210 });
  const r = applyGesture(start, from, to);
  assert.ok(Math.abs(r.scale - 2) < 1e-9);
  assert.ok(Math.abs(r.rotation - Math.PI / 2) < 1e-9);
  assert.deepEqual([r.x, r.y], [100 - 50 + 10, 100 + 110]);
  const huge = applyGesture(start, from, pinchOf({ x: 0, y: 0 }, { x: 10000, y: 0 }));
  assert.equal(huge.scale, MAX_SCALE);
  assert.equal(applyGesture(start, pinchOf({ x: 0, y: 0 }, { x: 0, y: 0 }), from).scale, 1);
});

test('isOverTrash', () => {
  assert.ok(isOverTrash({ x: 100, y: 500 }, { x: 110, y: 510 }));
  assert.ok(!isOverTrash({ x: 100, y: 300 }, { x: 110, y: 510 }));
});

test('text styles cycle and resolve', () => {
  assert.equal(nextTextStyle('caption'), 'big');
  assert.equal(nextTextStyle('big'), 'background');
  assert.equal(nextTextStyle('background'), 'caption');
  const cap = resolveTextStyle({ style: 'caption', color: '#FF0000' });
  assert.ok(cap.fullWidth);
  assert.equal(cap.color, '#FFFFFF');
  assert.equal(resolveTextStyle({ style: 'big', color: '#FF0000' }).color, '#FF0000');
  const bg = resolveTextStyle({ style: 'background', color: '#FFE436' });
  assert.equal(bg.backgroundColor, '#FFE436');
  assert.equal(bg.color, '#000000');
});

test('contrastText', () => {
  assert.equal(contrastText('#FFFFFF'), '#000000');
  assert.equal(contrastText('#000000'), '#FFFFFF');
  assert.equal(contrastText('#4298FF'), '#FFFFFF');
  assert.equal(contrastText('nonsense'), '#FFFFFF');
});

test('clampUnit and sanitizeText', () => {
  assert.equal(clampUnit(-1), 0.05);
  assert.equal(clampUnit(2), 0.9);
  assert.equal(clampUnit(NaN), 0.5);
  assert.equal(sanitizeText('  hoi\n\ndaar  '), 'hoi daar ');
  assert.equal(sanitizeText('x'.repeat(200)).length, MAX_TEXT_LENGTH);
});

test('timer: options, normalisation, labels', () => {
  assert.equal(TIMER_OPTIONS.length, 11);
  assert.equal(TIMER_OPTIONS.at(-1), null);
  assert.equal(normalizeViewSeconds(0), null);
  assert.equal(normalizeViewSeconds(15), 10);
  assert.equal(normalizeViewSeconds('3'), 3);
  assert.equal(normalizeViewSeconds(undefined), null);
  assert.equal(normalizeViewSeconds('abc'), null);
  assert.equal(timerLabel(null), '∞');
  assert.equal(timerLabel(5), '5 s');
  assert.equal(timingSummary({ viewSeconds: 3, viewOnce: true }), '3 sec · eenmalig bekijken');
  assert.equal(timingSummary({ viewSeconds: null, viewOnce: false }), 'Onbeperkt · opnieuw bekijken mag');
});

test('snapMessageFields and openDurationMs', () => {
  assert.deepEqual(snapMessageFields(DEFAULT_TIMING), { view_once: true, view_seconds: null });
  assert.deepEqual(snapMessageFields({ viewSeconds: 7, viewOnce: false }), { view_once: false, view_seconds: 7 });
  assert.equal(openDurationMs(4, true), 4000);
  assert.equal(openDurationMs(null, true), 85000);
  assert.equal(openDurationMs(null, false), null);
  assert.equal(openDurationMs(undefined, false), null);
});

test('hasOverlay', () => {
  assert.equal(hasOverlay(EMPTY_EDIT), false);
  assert.equal(hasOverlay({ ...EMPTY_EDIT, text: { text: '  ', style: 'big', color: '#fff', x: 0.5, y: 0.5 } }), false);
  assert.equal(hasOverlay({ ...EMPTY_EDIT, stickers: [{ id: 'a', emoji: '🔥', x: 0, y: 0, scale: 1, rotation: 0 }] }), true);
});
