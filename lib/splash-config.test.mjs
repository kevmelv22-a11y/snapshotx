import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('splash screen: expo-splash-screen plugin, dark app background, transparent neon X logo', () => {
  const app = JSON.parse(read('../app.json')).expo;
  const pkg = JSON.parse(read('../package.json'));
  assert.ok(pkg.dependencies['expo-splash-screen'] && pkg.dependencies['expo-system-ui']);
  const entry = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen');
  assert.ok(entry, 'plugin configured');
  const cfg = entry[1];
  assert.equal(cfg.backgroundColor, app.backgroundColor);
  assert.equal(cfg.android.backgroundColor, app.backgroundColor);
  assert.equal(cfg.resizeMode, 'contain');
  assert.ok(cfg.imageWidth >= 150 && cfg.imageWidth <= 260);
  assert.equal(cfg.dark, undefined, 'app is dark-only (userInterfaceStyle dark): no separate dark splash');
  assert.ok(existsSync(new URL('../' + cfg.image.replace(/^\.\//, ''), import.meta.url)));
  // PNG colour type 6 = RGBA (logo floats on the background colour instead of a grey square).
  const png = readFileSync(new URL('../' + cfg.image.replace(/^\.\//, ''), import.meta.url));
  assert.equal(png.readUInt32BE(16), 1024); assert.equal(png.readUInt32BE(20), 1024); assert.equal(png[25], 6);
});
