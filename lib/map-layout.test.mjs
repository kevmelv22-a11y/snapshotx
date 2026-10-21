import assert from 'node:assert/strict';
import test from 'node:test';
import { webMapListPadding, WEB_MAP_MIN_PADDING as MIN, WEB_MAP_OVERLAY_GAP as GAP } from './map-layout.ts';

test('web map list starts below the floating header and ends above the footer', () => {
  assert.deepEqual(webMapListPadding({ top: 8 + 145, bottom: 205 }), { paddingTop: 153 + GAP, paddingBottom: 205 + GAP });
});

test('a growing header (search field / location notice) pushes the list further down', () => {
  const small = webMapListPadding({ top: 100, bottom: 200 }).paddingTop;
  const big = webMapListPadding({ top: 190, bottom: 200 }).paddingTop;
  assert.ok(big > small);
});

test('before measuring (0, missing, NaN, negative) the old default padding is kept', () => {
  for (const v of [undefined, null, { top: 0, bottom: 0 }, { top: NaN, bottom: -5 }])
    assert.deepEqual(webMapListPadding(v), { paddingTop: MIN, paddingBottom: MIN }, JSON.stringify(v));
});

test('fractional layout heights round up so text is never clipped by a sub-pixel', () => {
  assert.deepEqual(webMapListPadding({ top: 100.2, bottom: 50.5 }), { paddingTop: 113, paddingBottom: 63 });
});
