import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);
const P = await import('./plus.ts');
const { createMockProvider } = await import('./plus-purchases.ts');
const now = Date.parse('2026-10-13T12:00:00Z'), D = 86400_000;
const ent = (o = {}) => ({ tier: 'plus', status: 'active', source: 'mock', productId: 'sx_plus_monthly', startsAt: new Date(now - 5 * D).toISOString(), expiresAt: new Date(now + 5 * D).toISOString(), graceUntil: null, willRenew: true, ...o });

test('plans and Dutch prices', () => {
  assert.equal(P.formatPrice(399), '€3,99');
  assert.equal(P.formatPrice(3999), '€39,99');
  assert.equal(P.formatPrice(5), '€0,05');
  assert.equal(P.periodLabel(P.getPlan('sx_plus_monthly')), 'per maand');
  assert.equal(P.yearlySavingPercent(), 16);
  assert.equal(P.monthlyEquivalentCents(P.getPlan('sx_plus_yearly')), 333);
  assert.equal(P.getPlan('nope'), undefined);
});

test('entitlement activity: expiry, grace, revoked, future, lifetime', () => {
  assert.equal(P.isPlus(ent(), now), true);
  assert.equal(P.isPlus(ent({ expiresAt: new Date(now - 1).toISOString() }), now), false);
  assert.equal(P.isPlus(ent({ expiresAt: new Date(now - D).toISOString(), status: 'grace', graceUntil: new Date(now + D).toISOString() }), now), true);
  assert.equal(P.isPlus(ent({ status: 'revoked' }), now), false);
  assert.equal(P.isPlus(ent({ status: 'refunded' }), now), false);
  assert.equal(P.isPlus(ent({ startsAt: new Date(now + D).toISOString() }), now), false);
  assert.equal(P.isPlus(ent({ expiresAt: null, source: 'promo' }), now), true);
  assert.equal(P.isPlus(null, now), false);
  assert.equal(P.isPlus([], now), false);
  assert.equal(P.isPlus([ent({ status: 'revoked' }), ent()], now), true);
  assert.equal(P.canUse('chat_wallpaper', false), false);
  assert.equal(P.canUse('chat_wallpaper', true), true);
});

test('entitlement labels and periods', () => {
  assert.equal(P.entitlementLabel(null, now), 'Geen X+');
  assert.equal(P.entitlementLabel(ent(), now), 'Verlengt op 18-10-2026');
  assert.equal(P.entitlementLabel(ent({ willRenew: false }), now), 'Loopt af op 18-10-2026');
  assert.equal(P.entitlementLabel(ent({ expiresAt: new Date(now - D).toISOString(), graceUntil: new Date(now + 2 * D).toISOString() }), now), 'Betaling mislukt, toegang tot 15-10-2026');
  assert.equal(P.addPeriod(Date.parse('2026-01-31T00:00:00Z'), 'year'), '2027-01-31T00:00:00.000Z');
  assert.equal(P.addPeriod(Date.parse('2026-10-13T12:00:00Z'), 'month'), '2026-11-13T12:00:00.000Z');
});

test('app icon falls back without X+', () => {
  assert.equal(P.effectiveAppIcon('neon', true), 'neon');
  assert.equal(P.effectiveAppIcon('neon', false), 'default');
  assert.equal(P.effectiveAppIcon('bogus', true), 'default');
  assert.equal(P.effectiveAppIcon(null, true), 'default');
});

test('chat wallpapers per thread, gated', () => {
  assert.equal(P.wallpaperFor('t1', { t1: 'aurora' }, true), 'aurora');
  assert.equal(P.wallpaperFor('t1', { t1: 'aurora' }, false), 'none');
  assert.equal(P.wallpaperFor('t2', { t1: 'aurora' }, true), 'none');
  assert.equal(P.wallpaperFor('t1', { t1: 'xx' }, true), 'none');
});

test('story rewatch count and label', () => {
  const v = (viewerId, storyId) => ({ viewerId, storyId, at: '' });
  const views = [v('a', 's'), v('a', 's'), v('b', 's'), v('c', 's'), v('c', 's'), v('c', 's'), v('me', 's'), v('me', 's'), v('a', 'x'), v('b', 'x')];
  assert.equal(P.rewatchCount(views, 's', 'me'), 2);
  assert.equal(P.rewatchCount(views, 's'), 3);
  assert.equal(P.rewatchCount(views, 'x', 'me'), 0);
  assert.equal(P.rewatchLabel(2, true), '2 vrienden keken opnieuw');
  assert.equal(P.rewatchLabel(1, true), '1 vriend keek opnieuw');
  assert.equal(P.rewatchLabel(2, false), null);
  assert.equal(P.rewatchLabel(0, true), null);
});

test('priority replies: X+ first, then newest, stable', () => {
  const r = (id, plus, min) => ({ id, senderId: id, senderPlus: plus, at: new Date(now - min * 60000).toISOString() });
  const out = P.sortStoryReplies([r('a', false, 1), r('b', true, 10), r('c', false, 5), r('d', true, 2), r('e', false, 1)]);
  assert.deepEqual(out.map(x => x.id), ['d', 'b', 'a', 'e', 'c']);
});

test('best friend pin', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }], id = x => x.id;
  assert.deepEqual(P.applyBffPin(l, id, 'c', true).map(id), ['c', 'a', 'b']);
  assert.deepEqual(P.applyBffPin(l, id, 'c', false).map(id), ['a', 'b', 'c']);
  assert.deepEqual(P.applyBffPin(l, id, 'zz', true).map(id), ['a', 'b', 'c']);
  assert.deepEqual(P.applyBffPin(l, id, null, true).map(id), ['a', 'b', 'c']);
  assert.deepEqual(l.map(id), ['a', 'b', 'c']);
  assert.equal(P.isPinnedBff('c', 'c', true), true);
  assert.equal(P.isPinnedBff('c', 'c', false), false);
});

test('mock provider: purchase, restore, cancel, failures', async () => {
  const m = createMockProvider({ now: () => now });
  const r = await m.purchase('sx_plus_yearly');
  assert.equal(r.ok, true);
  assert.equal(r.entitlement.expiresAt, '2027-10-13T12:00:00.000Z');
  assert.equal(P.isPlus(await m.restore(), now), true);
  await m.cancelRenewal();
  assert.equal((await m.restore())[0].willRenew, false);
  assert.equal((await m.purchase('bad')).reason, 'unknown_product');
  assert.equal((await createMockProvider({ fail: 'cancelled' }).purchase('sx_plus_monthly')).reason, 'cancelled');
  assert.deepEqual(await createMockProvider().restore(), []);
});
