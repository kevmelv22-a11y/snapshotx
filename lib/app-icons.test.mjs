import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const P = await import('./plus.ts');
const root = new URL('../', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
function png(f) { const b = fs.readFileSync(new URL(f, root)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; }

test('11 icons: Standaard free, the 10 logos X+-only, unique ids/names', () => {
  assert.equal(P.APP_ICONS.length, 11);
  assert.deepEqual(P.APP_ICONS[0], { id: 'default', label: 'Standaard', native: null, plusOnly: false });
  for (const i of P.APP_ICONS.slice(1)) { assert.equal(i.plusOnly, true); assert.match(i.native, /^[A-Z][A-Za-z]+$/); }
  assert.equal(new Set(P.APP_ICONS.map(i => i.id)).size, 11);
  for (const old of ['galaxy', 'neon', 'zon', 'nacht']) assert.equal(P.effectiveAppIcon(old, true), 'default');
  assert.equal(P.effectiveAppIcon('boog', false), 'default');
  assert.equal(P.effectiveAppIcon('boog', true), 'boog');
});
test('icon files: 1024 RGB (no alpha) + previews', () => {
  for (const i of P.APP_ICONS) {
    if (i.id !== 'default') { const p = png(`assets/app-icons/${i.id}.png`); assert.deepEqual([p.w, p.h, p.colorType], [1024, 1024, 2], i.id); }
    const q = png(`assets/app-icons/preview/${i.id}.png`); assert.equal(q.w, q.h);
    assert.match(read('lib/app-icon-assets.ts'), new RegExp(`preview/${i.id}\\.png`));
  }
});
test('app.json registers every alternate icon with expo-alternate-app-icons', () => {
  const plugins = JSON.parse(read('app.json')).expo.plugins;
  const e = plugins.find(p => Array.isArray(p) && p[0] === 'expo-alternate-app-icons');
  assert.ok(e);
  const want = P.APP_ICONS.filter(i => i.native).map(i => [i.native, `./assets/app-icons/${i.id}.png`]);
  assert.deepEqual(e[1].map(x => [x.name, x.ios]), want);
  for (const x of e[1]) assert.equal(x.android.backgroundColor, '#000000');
});
test('web swaps favicon + apple-touch-icon; honest note', () => {
  const a = read('lib/app-icon-apply.ts');
  assert.match(a, /setLink\('icon'/); assert.match(a, /setLink\('apple-touch-icon'/); assert.match(a, /supportsAlternateIcons/);
  assert.match(read('app/_layout.tsx'), /<AppIconSync\/>/);
  assert.match(read('app/plus-settings.tsx'), /Op iPhone verandert het icoon op je beginscherm vanaf de volgende app-versie/);
});
