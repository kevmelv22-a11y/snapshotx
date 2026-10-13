import assert from 'node:assert/strict';
import test from 'node:test';
import { clampOffset, hiddenEdges, pageStep, revealOffset } from './scroll-affordance.ts';

test('hiddenEdges: nothing hidden when content fits or is not measured yet', () => {
  assert.deepEqual(hiddenEdges({ offset: 0, viewport: 0, content: 0 }), { left: false, right: false });
  assert.deepEqual(hiddenEdges({ offset: 0, viewport: 390, content: 392 }), { left: false, right: false });
});

test('hiddenEdges: right at start, both in the middle, left at the end (with sub-pixel slack)', () => {
  assert.deepEqual(hiddenEdges({ offset: 0, viewport: 320, content: 700 }), { left: false, right: true });
  assert.deepEqual(hiddenEdges({ offset: 200, viewport: 320, content: 700 }), { left: true, right: true });
  assert.deepEqual(hiddenEdges({ offset: 379.5, viewport: 320, content: 700 }), { left: true, right: false });
});

test('clampOffset keeps the offset inside the scrollable range', () => {
  assert.equal(clampOffset(-20, 320, 700), 0);
  assert.equal(clampOffset(9999, 320, 700), 380);
  assert.equal(clampOffset(50, 320, 200), 0);
});

test('revealOffset scrolls only when the item is (partly) hidden, leaving room for the chevrons', () => {
  const m = { offset: 0, viewport: 320, content: 700 };
  assert.equal(revealOffset(20, 100, m), null);
  assert.equal(revealOffset(560, 120, m), 380); // last tab -> clamped to the end
  assert.equal(revealOffset(300, 90, m), 110);
  assert.equal(revealOffset(10, 90, { ...m, offset: 200 }), 0);
  assert.equal(revealOffset(10, 0, m), null);
});

test('pageStep moves most of a viewport and clamps', () => {
  const m = { offset: 0, viewport: 320, content: 700 };
  assert.equal(pageStep(1, m), 192);
  assert.equal(pageStep(1, { ...m, offset: 300 }), 380);
  assert.equal(pageStep(-1, { ...m, offset: 100 }), 0);
});
