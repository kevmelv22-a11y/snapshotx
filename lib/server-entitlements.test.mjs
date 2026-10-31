import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);
const S = await import('./server-entitlements.ts');
const P = await import('./plus.ts');
const R = await import('./revenuecat-logic.ts');
const now = Date.parse('2026-10-31T20:00:00Z');
const joanna = { tier: 'platinum', status: 'active', source: 'staff', product_id: null, starts_at: '2026-10-31T18:00:00Z', expires_at: null, grace_until: null, will_renew: false };

test('staff platinum row (no expiry) maps to an active platinum entitlement', () => {
  const e = S.rowsToEntitlements([joanna], now);
  assert.equal(e.length, 1); assert.equal(e[0].source, 'staff');
  assert.equal(P.activeTier(e, now), 'platinum'); assert.equal(P.isPlus(e, now), true);
});
test('revoked / expired / future / unknown-tier rows are dropped', () => {
  const rows = [{ ...joanna, status: 'revoked' }, { ...joanna, expires_at: '2026-10-01T00:00:00Z' }, { ...joanna, starts_at: '2027-01-01T00:00:00Z' }, { ...joanna, tier: 'gold' }];
  assert.deepEqual(S.rowsToEntitlements(rows, now), []);
  assert.deepEqual(S.rowsToEntitlements(null, now), []);
});
test('merge with RevenueCat: highest tier wins either way', () => {
  const rc = R.rcToEntitlements({ entitlements: { active: { snapshot_x: { expirationDate: '2026-12-01T00:00:00Z', latestPurchaseDate: '2026-10-01T00:00:00Z' } } } });
  const server = S.rowsToEntitlements([joanna], now);
  assert.equal(P.activeTier(S.mergeEntitlements(rc, server, now), now), 'platinum');
  assert.equal(P.activeTier(S.mergeEntitlements(server, rc, now), now), 'platinum');
  assert.equal(P.activeTier(S.mergeEntitlements(rc, [], now), now), 'plus');
  assert.equal(P.activeTier(S.mergeEntitlements([], [], now), now), null);
  assert.equal(S.mergeEntitlements(rc, server, now)[0].tier, 'platinum');
});
test('migration: tier rank makes higher tiers include lower ones; set_tier audited', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../supabase/migrations/20261031201500_sx_tier_rank_staff_set_tier.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function app_private\.sx_tier_rank/);
  assert.match(sql, /sx_tier_rank\(e\.tier\) >= app_private\.sx_tier_rank\(want\)/);
  assert.match(sql, /create or replace function public\.sx_staff_set_tier/);
  assert.match(sql, /sx_require_staff\(array\['ADMIN','OWNER'\]\)/);
  assert.match(sql, /insert into public\.audit_logs/);
  assert.doesNotMatch(sql, /grant execute on function public\.sx_staff_set_tier[^;]*anon/);
});
