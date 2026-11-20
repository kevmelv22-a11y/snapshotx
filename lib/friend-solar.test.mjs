import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as S from './friend-solar.ts';

test('planet per rank: 1 = Mercurius … 8 = Neptunus, anything else none', () => {
  assert.equal(S.PLANETS.length, 8);
  assert.equal(S.planetFor(1).name, 'Mercurius'); assert.equal(S.planetFor(3).name, 'Aarde'); assert.equal(S.planetFor(8).name, 'Neptunus');
  for (const r of [0, 9, -1, 2.5, null, undefined, NaN]) assert.equal(S.planetFor(r), null);
  S.PLANETS.forEach((p, i) => assert.equal(p.rank, i + 1));
});
test('line under the orbit (first name, Dutch)', () => {
  assert.equal(S.solarLine(2, 'Eva de Vries'), 'Jij bent Venus 🪐 — #2 in de beste vrienden van Eva');
  assert.match(S.solarLine(null, 'Bram'), /niet in de beste vrienden van Bram/);
  assert.match(S.solarLine(4, ''), /van je vriend$/);
});
test('friend profile: Plus-gated, uses read-only sx_friend_ranks only', async () => {
  const src = await readFile(new URL('../app/friend/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /rpc\('sx_friend_ranks'\)/);
  assert.match(src, /testID="solar-system"/);
  assert.match(src, /isPro/);
});
