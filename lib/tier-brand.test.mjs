import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);
const B = await import('./tier-brand.ts');
const P = await import('./plus.ts');
const png = f => { const b = readFileSync(new URL(`../assets/tiers/${f}.png`, import.meta.url)); assert.equal(b.toString('ascii', 1, 4), 'PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; };
const FILE = { plus: 'x', lens: 'lens', platinum: 'platinum', family: 'family' };

test('tier display names (internal ids unchanged)', () => {
  assert.equal(P.tierInfo('plus').name, 'Snapshot X+');
  assert.equal(P.tierInfo('lens').name, 'Snapshot X Lens');
  assert.equal(P.tierInfo('platinum').name, 'Snapshot Platinum');
  assert.equal(P.tierInfo('family').name, 'Snapshot Family');
  assert.deepEqual(P.TIERS.map(t => t.id), ['plus', 'family', 'lens', 'platinum', 'storage']);
  for (const t of B.BRAND_TIERS) assert.equal(B.TIER_BRAND[t].label, P.tierInfo(t).name);
  assert.equal(B.isBrandTier('storage'), false); assert.equal(B.isBrandTier(null), false); assert.equal(B.isBrandTier('lens'), true);
});

test('tier logo PNGs exist, are RGBA and match declared aspects', () => {
  for (const t of B.BRAND_TIERS) for (const kind of ['wordmark', 'icon']) {
    const { w, h, colorType } = png(`${FILE[t]}-${kind}`);
    assert.equal(colorType, 6, `${t} ${kind} must be RGBA`);
    assert.deepEqual([w, h], B.TIER_BRAND[t][kind]);
  }
  assert.equal(B.brandWidth('plus', 'wordmark', 32), Math.round(32 * 650 / 160));
});
