import assert from 'node:assert/strict';
import test from 'node:test';
import { darkGreenStyle, WEB_MAP_COLORS } from './map-web-style.ts';

const style = {version: 8, layers: [
  {id: 'background', type: 'background', paint: {'background-color': '#fff'}},
  {id: 'natural_earth', type: 'raster'},
  {id: 'water', type: 'fill', paint: {'fill-color': '#00f'}},
  {id: 'park', type: 'fill', paint: {'fill-color': '#0f0'}},
  {id: 'road_motorway', type: 'line', paint: {'line-color': '#fc8'}},
  {id: 'road_minor_casing', type: 'line', paint: {'line-color': '#ccc'}},
  {id: 'building-3d', type: 'fill-extrusion', paint: {'fill-extrusion-color': '#eee'}},
  {id: 'poi_r1', type: 'symbol', paint: {'text-color': '#666'}},
]};

test('recolours liberty into the dark green iOS look and keeps 3D buildings', () => {
  const out = darkGreenStyle(style);
  const byId = Object.fromEntries(out.layers.map(l => [l.id, l]));
  assert.equal(byId.natural_earth, undefined);
  assert.equal(byId.background.paint['background-color'], WEB_MAP_COLORS.land);
  assert.equal(byId.water.paint['fill-color'], WEB_MAP_COLORS.water);
  assert.equal(byId.park.paint['fill-color'], WEB_MAP_COLORS.park);
  assert.equal(byId.road_motorway.paint['line-color'], WEB_MAP_COLORS.motorway);
  assert.equal(byId.road_minor_casing.paint['line-color'], WEB_MAP_COLORS.casing);
  assert.equal(byId['building-3d'].paint['fill-extrusion-color'], WEB_MAP_COLORS.building3d);
  assert.equal(byId.poi_r1.paint['text-color'], WEB_MAP_COLORS.poi);
  assert.equal(style.layers[0].paint['background-color'], '#fff', 'input untouched');
});

test('never emits undefined layout (MapLibre validation)', () => {
  for (const layer of darkGreenStyle(style).layers) assert.ok(!('layout' in layer) || layer.layout !== undefined, layer.id);
});
