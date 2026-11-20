import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PLANS } from './plus.ts';
import { rcProductPlan } from './revenuecat-logic.ts';

// docs/revenuecat/GOOGLE_PLAY_NL.md step 1.4: Play subscription `snapshot_x_<tier>` + base plan `monthly`/`yearly`.
test('every app plan has its Google Play product id in the doc and maps back to the same plan', async () => {
  const doc = await readFile(new URL('../docs/revenuecat/GOOGLE_PLAY_NL.md', import.meta.url), 'utf8');
  for (const p of PLANS) {
    const base = p.period === 'month' ? 'monthly' : 'yearly';
    const playId = `snapshot_x_${p.tier}:${base}`;
    assert.equal(rcProductPlan(playId).planId, p.id, playId);
    assert.equal(rcProductPlan(playId).tier, p.tier, playId);
    assert.ok(doc.includes(`\`snapshot_x_${p.tier}\``), `doc lists subscription snapshot_x_${p.tier}`);
  }
  assert.ok(!PLANS.some(p => p.period === 'lifetime'), 'no lifetime plan in the app → none on Play at launch');
  assert.doesNotMatch(doc, /`lifetime`: TODO/);
});
