import assert from 'node:assert/strict';
import test from 'node:test';
import { imageRectToCoverView } from './face-mapping.ts';

test('maps without cropping when aspect ratios match', () => {
  assert.deepEqual(imageRectToCoverView(
    { x: 100, y: 200, width: 300, height: 400 },
    { width: 1000, height: 2000 }, { width: 500, height: 1000 },
  ), { x: 50, y: 100, width: 150, height: 200 });
});

test('accounts for horizontal cover crop', () => {
  assert.deepEqual(imageRectToCoverView(
    { x: 350, y: 100, width: 300, height: 200 },
    { width: 1000, height: 500 }, { width: 500, height: 500 },
  ), { x: 100, y: 100, width: 300, height: 200 });
});

test('accounts for vertical cover crop', () => {
  assert.deepEqual(imageRectToCoverView(
    { x: 100, y: 350, width: 200, height: 300 },
    { width: 500, height: 1000 }, { width: 500, height: 500 },
  ), { x: 100, y: 100, width: 200, height: 300 });
});

test('rejects invalid dimensions', () => {
  assert.throws(() => imageRectToCoverView(
    { x: 0, y: 0, width: 1, height: 1 },
    { width: 0, height: 20 }, { width: 50, height: 50 },
  ));
});
