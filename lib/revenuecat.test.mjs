import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasProEntitlement, mapPackages, purchaseErrorMessage, rcApiKey, rcApiKeyFor, rcToEntitlements, storeName, RC_TEST_KEY } from './revenuecat-logic.ts';

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
