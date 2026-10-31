import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const pub = f => new URL(`../public/${f}`, import.meta.url);
const html = readFileSync(pub('index.html'), 'utf8');
const pngSize = f => { const b = readFileSync(pub(f)); assert.equal(b.toString('ascii', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('index.html: Dutch, SEO description, link previews and install metadata', () => {
  assert.match(html, /<html lang="nl"/);
  assert.match(html, /<meta name="description" content="[^"]{40,160}"/);
  for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) assert.match(html, new RegExp(`property="${p}"`));
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.doesNotMatch(html, /httpEquiv/, 'raw HTML needs http-equiv');
  assert.doesNotMatch(html, /demo/i);
});

test('every icon/image the HTML and manifest point to exists with the right size', () => {
  const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.lang, 'nl'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.display, 'standalone');
  for (const i of manifest.icons) { const [w, h] = pngSize(i.src.slice(1)); assert.equal(`${w}x${h}`, i.sizes); }
  assert.deepEqual(pngSize('icons/og-image.png'), [1200, 630]);
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
  for (const m of html.matchAll(/(?:href|content)="(?:https:\/\/snapshot-x\.nl)?(\/icons\/[^"]+)"/g)) assert.ok(existsSync(pub(m[1].slice(1))), m[1]);
});

test('robots.txt keeps private areas out of search engines', () => {
  const robots = readFileSync(pub('robots.txt'), 'utf8');
  for (const p of ['/staff', '/chat', '/call', '/auth', '/add', '/my-data']) assert.match(robots, new RegExp(`^Disallow: ${p}$`, 'm'));
  assert.match(robots, /^Sitemap: https:\/\/snapshot-x\.nl\/sitemap\.xml$/m);
  assert.match(readFileSync(pub('sitemap.xml'), 'utf8'), /<loc>https:\/\/snapshot-x\.nl\/help<\/loc>/);
});
