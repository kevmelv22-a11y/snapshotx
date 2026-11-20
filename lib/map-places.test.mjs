import assert from 'node:assert/strict';
import test from 'node:test';
import * as M from './map-places.ts';

test('places list is valid and public', () => {
  assert.ok(M.PLACES.length >= 20);
  const ids = new Set(M.PLACES.map(p => p.id)); assert.equal(ids.size, M.PLACES.length);
  for (const p of M.PLACES) {
    assert.ok(p.latitude > 50.7 && p.latitude < 53.6 && p.longitude > 3.3 && p.longitude < 7.3, p.id);
    assert.ok(p.weight >= 1 && p.weight <= 5); assert.ok(M.CATEGORY_INFO[p.category]);
  }
});
test('busy factor + heat points', () => {
  assert.equal(M.busyFactor('uitgaan', 23), 1.3); assert.equal(M.busyFactor('uitgaan', 10), 0.5);
  assert.equal(M.busyFactor('strand', 14), 1.3); assert.equal(M.busyFactor('stad', 4), 0.6); assert.equal(M.busyFactor('stad', -1), 0.6);
  const pts = M.heatPoints([M.PLACES[0]], [{ latitude: 52, longitude: 5 }, { latitude: NaN, longitude: 5 }], 12);
  assert.equal(pts.length, 2); assert.equal(pts[0].weight, 5.5); assert.equal(pts[1].weight, 2);
});
test('distance, labels, nearby, friends near', () => {
  const dam = M.PLACES.find(p => p.id === 'dam'), vondel = M.PLACES.find(p => p.id === 'vondelpark');
  const d = M.distanceKm(dam, vondel); assert.ok(d > 1.5 && d < 2.5, String(d));
  assert.equal(M.distanceLabel(0.234), '250 m'); assert.equal(M.distanceLabel(0.01), '50 m'); assert.equal(M.distanceLabel(3.26), '3,3 km'); assert.equal(M.distanceLabel(42.4), '42 km');
  assert.equal(M.nearbyPlaces({ latitude: 51.98, longitude: 5.9 })[0].city, 'Arnhem');
  assert.ok(M.nearbyPlaces(null, 'strand').every(p => p.category === 'strand'));
  assert.equal(M.nearbyPlaces(null)[0].weight, 5);
  assert.equal(M.friendsNear(dam, [{ latitude: 52.374, longitude: 4.893 }, { latitude: 51.9, longitude: 4.4 }]).length, 1);
  assert.deepEqual(M.heatCircle(0), { radius: 500, opacity: 0.12 }); assert.ok(M.heatCircle(99).radius <= 500 + 7 * 260);
});
