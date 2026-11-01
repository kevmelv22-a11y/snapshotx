import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasProEntitlement, mapPackages, purchaseErrorMessage, rcApiKey, rcApiKeyFor, rcProductPlan, rcSource, rcToEntitlements, storeName, RC_TEST_KEY } from './revenuecat-logic.ts';
import { PLANS } from './plus.ts';

test('isPro only when snapshot_x is active', () => {
  assert.equal(hasProEntitlement(null), false);
  assert.equal(hasProEntitlement({ entitlements: { active: {} } }), false);
  assert.equal(hasProEntitlement({ entitlements: { active: { other: {} } } }), false);
  assert.equal(hasProEntitlement({ entitlements: { active: { snapshot_x: { expirationDate: null } } } }), true);
});
test('maps $rc_* and custom identifiers to lifetime/yearly/monthly', () => {
  const rc = mapPackages({ availablePackages: [{ identifier: '$rc_monthly' }, { identifier: '$rc_annual' }, { identifier: '$rc_lifetime' }] });
  assert.deepEqual([rc.lifetime.identifier, rc.yearly.identifier, rc.monthly.identifier], ['$rc_lifetime', '$rc_annual', '$rc_monthly']);
  const custom = mapPackages({ availablePackages: [{ identifier: 'yearly' }, { identifier: 'monthly' }, { identifier: 'lifetime' }, { identifier: 'x' }] });
  assert.equal(custom.yearly.identifier, 'yearly'); assert.equal(custom.lifetime.identifier, 'lifetime');
  const byType = mapPackages({ availablePackages: [{ identifier: 'foo', packageType: 'ANNUAL' }] });
  assert.equal(byType.yearly.identifier, 'foo'); assert.equal(byType.monthly, undefined);
  assert.deepEqual(mapPackages(null), {});
});
test('errors: cancel silent, network/store in Dutch', () => {
  assert.equal(purchaseErrorMessage({ code: '1', userCancelled: true }), null);
  assert.equal(purchaseErrorMessage({ userCancelled: true }), null);
  assert.match(purchaseErrorMessage({ code: '10' }), /verbinding/);
  assert.match(purchaseErrorMessage({ code: '2' }), /App Store/);
  assert.match(purchaseErrorMessage({ code: '999' }), /mislukt/);
});
test('api key fallback and entitlement mapping', () => {
  assert.equal(rcApiKey(undefined), RC_TEST_KEY); assert.equal(rcApiKey(' '), RC_TEST_KEY); assert.equal(rcApiKey('appl_x'), 'appl_x');
  assert.deepEqual(rcToEntitlements({ entitlements: { active: {} } }), []);
  const [e] = rcToEntitlements({ entitlements: { active: { snapshot_x: { expirationDate: null, periodType: 'NORMAL', latestPurchaseDate: '2026-10-01T00:00:00Z' } } } });
  assert.equal(e.tier, 'plus'); assert.equal(e.expiresAt, null); assert.equal(e.status, 'active'); assert.equal(e.source, 'app_store');
});

test('RevenueCat key per platform: iOS appl_, Android goog_, never the other store key, test key fallback', () => {
  const env = { ios: 'appl_abc', android: 'goog_xyz' };
  assert.equal(rcApiKeyFor('ios', env), 'appl_abc');
  assert.equal(rcApiKeyFor('android', env), 'goog_xyz');
  assert.equal(rcApiKeyFor('android', { ios: 'appl_abc' }), RC_TEST_KEY);
  assert.equal(rcApiKeyFor('android', { android: 'appl_abc' }), RC_TEST_KEY);
  assert.equal(rcApiKeyFor('ios', { ios: 'goog_xyz' }), RC_TEST_KEY);
  assert.equal(rcApiKeyFor('ios', {}), RC_TEST_KEY);
  assert.equal(storeName('android'), 'Google Play');
  assert.equal(storeName('ios'), 'App Store');
  assert.match(purchaseErrorMessage({ code: '2' }, 'android'), /Google Play/);
  assert.doesNotMatch(purchaseErrorMessage({ code: '2' }, 'android'), /App Store/);
  const rc = readFileSync(new URL('./revenuecat.ts', import.meta.url), 'utf8');
  assert.match(rc, /EXPO_PUBLIC_REVENUECAT_ANDROID_KEY/);
});

test('release builds never configure with the Test Store key', async () => {
  const { rcKeyUsable, RC_TEST_KEY } = await import('./revenuecat-logic.ts');
  assert.equal(rcKeyUsable(RC_TEST_KEY, false), false);
  assert.equal(rcKeyUsable(RC_TEST_KEY, true), true);
  assert.equal(rcKeyUsable('goog_abc', false), true);
});

test('RC product id → tier/period: App Store/Test Store ids and Google Play abonnement:basisabonnement ids', () => {
  assert.deepEqual(rcProductPlan('monthly'), { tier: 'plus', period: 'month', planId: 'sx_plus_monthly' });
  assert.deepEqual(rcProductPlan('yearly'), { tier: 'plus', period: 'year', planId: 'sx_plus_yearly' });
  assert.deepEqual(rcProductPlan('lifetime'), { tier: 'plus', period: 'lifetime', planId: null });
  assert.deepEqual(rcProductPlan('platinum_yearly'), { tier: 'platinum', period: 'year', planId: 'sx_platinum_yearly' });
  assert.deepEqual(rcProductPlan('snapshot_x_platinum:monthly'), { tier: 'platinum', period: 'month', planId: 'sx_platinum_monthly' });
  assert.deepEqual(rcProductPlan('snapshot_x_plus:yearly'), { tier: 'plus', period: 'year', planId: 'sx_plus_yearly' });
  assert.equal(rcProductPlan('snapshot_x_family:monthly').tier, 'family');
  assert.equal(rcProductPlan('snapshot_x_lens:monthly').tier, 'lens');
  assert.equal(rcProductPlan('snapshot_x_storage:yearly').planId, 'sx_storage_yearly');
  assert.deepEqual(rcProductPlan(undefined), { tier: 'plus', period: null, planId: null });
  // Every Play product id from docs/revenuecat/GOOGLE_PLAY_NL.md maps onto a real plan of lib/plus.ts.
  for (const id of ['snapshot_x_plus:monthly', 'snapshot_x_plus:yearly', 'snapshot_x_family:monthly', 'snapshot_x_lens:monthly', 'snapshot_x_platinum:monthly', 'snapshot_x_platinum:yearly', 'snapshot_x_storage:monthly', 'snapshot_x_storage:yearly'])
    assert.ok(PLANS.some(p => p.id === rcProductPlan(id).planId), id);
});

test('RC entitlement on Android: source play, tier from the product, plan id filled', () => {
  const info = p => ({ entitlements: { active: { snapshot_x: { productIdentifier: p.id, store: p.store, periodType: 'NORMAL', expirationDate: '2026-12-01T00:00:00Z', latestPurchaseDate: '2026-11-01T00:00:00Z', willRenew: true } } } });
  const [a] = rcToEntitlements(info({ id: 'snapshot_x_platinum:monthly', store: 'PLAY_STORE' }), 'android');
  assert.equal(a.tier, 'platinum'); assert.equal(a.source, 'play'); assert.equal(a.productId, 'sx_platinum_monthly'); assert.equal(a.willRenew, true);
  const [i] = rcToEntitlements(info({ id: 'platinum_yearly', store: 'APP_STORE' }), 'ios');
  assert.equal(i.tier, 'platinum'); assert.equal(i.source, 'app_store'); assert.equal(i.productId, 'sx_platinum_yearly');
  assert.equal(rcSource('TEST_STORE', 'android'), 'play');
  assert.equal(rcSource('TEST_STORE', 'ios'), 'app_store');
  assert.equal(rcSource('PROMOTIONAL', 'android'), 'promo');
  const [l] = rcToEntitlements(info({ id: 'lifetime', store: 'PLAY_STORE' }), 'android');
  assert.equal(l.tier, 'plus'); assert.equal(l.productId, null);
});
