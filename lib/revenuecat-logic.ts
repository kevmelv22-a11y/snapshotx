/** Pure RevenueCat helpers (no React Native imports) so they run under `node --test`. */
import { PLANS, type PlanId } from './plus';
export const RC_ENTITLEMENT = 'snapshot_x';
/** Public RevenueCat Test Store SDK key (safe to ship). Production needs an `appl_` key (EXPO_PUBLIC_REVENUECAT_IOS_KEY)
 *  and a `goog_` key (EXPO_PUBLIC_REVENUECAT_ANDROID_KEY); see docs/revenuecat/GOOGLE_PLAY_NL.md. */
export const RC_TEST_KEY = 'test_FHajsikJnhKazfUlcsUduRIJtqI';
export const rcApiKey = (env: string | undefined): string => (env && env.trim()) || RC_TEST_KEY;
export type StoreOs = 'ios' | 'android' | string;
/** Public SDK key for this platform: iOS → appl_ key, Android → goog_ key; a key of the other store is never used. */
export function rcApiKeyFor(os: StoreOs, env: { ios?: string; android?: string }): string {
  const key = rcApiKey(os === 'android' ? env.android : env.ios);
  if (os === 'android' && key.startsWith('appl_')) return RC_TEST_KEY;
  if (os === 'ios' && key.startsWith('goog_')) return RC_TEST_KEY;
  return key;
}
/** Release builds must never configure the SDK with the Test Store key (RevenueCat aborts release apps that do). */
export function rcKeyUsable(key: string, isDev: boolean): boolean {
  return isDev || key !== RC_TEST_KEY;
}
/** Store name in user-facing Dutch copy. */
export const storeName = (os: StoreOs): string => (os === 'android' ? 'Google Play' : 'App Store');

type InfoLike = { entitlements?: { active?: Record<string, { expirationDate?: string | null; willRenew?: boolean; latestPurchaseDate?: string; productIdentifier?: string; periodType?: string; store?: string } | undefined> } } | null | undefined;
/** isPro: the `snapshot_x` entitlement is active. */
export function hasProEntitlement(info: InfoLike, id: string = RC_ENTITLEMENT): boolean {
  return !!info?.entitlements?.active?.[id];
}

export type PlanKey = 'lifetime' | 'yearly' | 'monthly';
type PkgLike = { identifier: string; packageType?: string };
const TYPES: Record<PlanKey, string[]> = { lifetime: ['$rc_lifetime', 'lifetime', 'LIFETIME'], yearly: ['$rc_annual', 'yearly', 'annual', 'ANNUAL'], monthly: ['$rc_monthly', 'monthly', 'MONTHLY'] };
/** Map an offering's packages onto lifetime/yearly/monthly by RC identifier ($rc_*), custom identifier or packageType. */
export function mapPackages<P extends PkgLike>(offering: { availablePackages?: P[] } | null | undefined): Partial<Record<PlanKey, P>> {
  const out: Partial<Record<PlanKey, P>> = {};
  for (const p of offering?.availablePackages ?? []) for (const k of Object.keys(TYPES) as PlanKey[])
    if (!out[k] && (TYPES[k].includes(p.identifier) || (p.packageType != null && TYPES[k].includes(p.packageType)))) out[k] = p;
  return out;
}

type ErrLike = { code?: string | number; userCancelled?: boolean | null; message?: string } | null | undefined;
/** Dutch user message for a purchase/restore error; null when the user cancelled (stay silent). */
export function purchaseErrorMessage(e: ErrLike, os: StoreOs = 'ios'): string | null {
  if (!e) return null;
  const code = String(e.code ?? '');
  if (e.userCancelled || code === '1') return null;
  if (code === '10' || code === '35') return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  if (code === '2' || code === '32') return `Er is een probleem met ${os === 'android' ? 'Google Play' : 'de App Store'}. Probeer het later opnieuw.`;
  if (code === '20') return 'Je betaling wordt nog verwerkt. Je krijgt toegang zodra die is goedgekeurd.';
  if (code === '3') return 'Aankopen zijn niet toegestaan op dit toestel.';
  if (code === '5') return 'Dit product is nu niet beschikbaar.';
  if (code === '6') return 'Je hebt dit al gekocht. Probeer "Aankopen herstellen".';
  return 'Aankoop mislukt, probeer het later opnieuw.';
}

const RC_TIERS = ['platinum', 'family', 'lens', 'storage', 'plus'] as const;
export type RcProductPlan = { tier: 'plus' | 'family' | 'lens' | 'platinum' | 'storage'; period: 'month' | 'year' | 'lifetime' | null; planId: string | null };
/** Which tier/period a store product is. Works for App Store / Test Store ids (`monthly`, `platinum_yearly`) and Google Play
 *  `abonnement:basisabonnement` ids (`snapshot_x_platinum:monthly`, docs/revenuecat/GOOGLE_PLAY_NL.md). Unknown → X+ (the
 *  entitlement is snapshot_x either way), period null. */
export function rcProductPlan(productId: string | null | undefined): RcProductPlan {
  const id = String(productId ?? '').trim().toLowerCase().replace(/^snapshot_x_/, '').replace(/^sx_/, '');
  const parts = id.split(/[:._-]+/).filter(Boolean);
  const tier = RC_TIERS.find(t => parts.includes(t)) ?? 'plus';
  const period = parts.some(p => p === 'lifetime') ? 'lifetime'
    : parts.some(p => p === 'yearly' || p === 'annual' || p === 'p1y' || p === 'year') ? 'year'
    : parts.some(p => p === 'monthly' || p === 'p1m' || p === 'month') ? 'month' : null;
  const planId = period === 'month' || period === 'year' ? `sx_${tier}_${period === 'month' ? 'monthly' : 'yearly'}` : null;
  return { tier, period, planId };
}
/** Store an RC entitlement was bought in → Entitlement.source ('play' on Google Play). Test Store / unknown: by platform. */
export function rcSource(store: string | null | undefined, os: StoreOs = 'ios'): 'app_store' | 'play' | 'promo' {
  const s = String(store ?? '').toUpperCase();
  if (s === 'PLAY_STORE') return 'play';
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'app_store';
  if (s === 'PROMOTIONAL') return 'promo';
  return os === 'android' ? 'play' : 'app_store';
}

/** Translate RC customer info into the app's Entitlement cache shape (tier plus). */
export function rcToEntitlements(info: InfoLike, os: StoreOs = 'ios') {
  const e = info?.entitlements?.active?.[RC_ENTITLEMENT];
  if (!e) return [];
  const plan = rcProductPlan(e.productIdentifier);
  const productId = (PLANS.find(p => p.id === plan.planId)?.id ?? null) as PlanId | null;
  return [{ tier: plan.tier, status: (e.periodType === 'TRIAL' ? 'trial' : 'active') as 'trial' | 'active', source: rcSource(e.store, os), productId,
    startsAt: e.latestPurchaseDate ?? new Date(0).toISOString(), expiresAt: e.expirationDate ?? null, graceUntil: null, willRenew: e.willRenew ?? false }];
}
