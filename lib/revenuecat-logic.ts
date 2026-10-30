/** Pure RevenueCat helpers (no React Native imports) so they run under `node --test`. */
export const RC_ENTITLEMENT = 'snapshot_x';
/** Public RevenueCat Test Store SDK key (safe to ship). Production needs an `appl_` key via EXPO_PUBLIC_REVENUECAT_IOS_KEY. */
export const RC_TEST_KEY = 'test_FHajsikJnhKazfUlcsUduRIJtqI';
export const rcApiKey = (env: string | undefined): string => (env && env.trim()) || RC_TEST_KEY;

type InfoLike = { entitlements?: { active?: Record<string, { expirationDate?: string | null; willRenew?: boolean; latestPurchaseDate?: string; productIdentifier?: string; periodType?: string } | undefined> } } | null | undefined;
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
export function purchaseErrorMessage(e: ErrLike): string | null {
  if (!e) return null;
  const code = String(e.code ?? '');
  if (e.userCancelled || code === '1') return null;
  if (code === '10' || code === '35') return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  if (code === '2' || code === '32') return 'Er is een probleem met de App Store. Probeer het later opnieuw.';
  if (code === '20') return 'Je betaling wordt nog verwerkt. Je krijgt toegang zodra die is goedgekeurd.';
  if (code === '3') return 'Aankopen zijn niet toegestaan op dit toestel.';
  if (code === '5') return 'Dit product is nu niet beschikbaar.';
  if (code === '6') return 'Je hebt dit al gekocht. Probeer "Aankopen herstellen".';
  return 'Aankoop mislukt, probeer het later opnieuw.';
}

/** Translate RC customer info into the app's Entitlement cache shape (tier plus). */
export function rcToEntitlements(info: InfoLike) {
  const e = info?.entitlements?.active?.[RC_ENTITLEMENT];
  if (!e) return [];
  return [{ tier: 'plus' as const, status: (e.periodType === 'TRIAL' ? 'trial' : 'active') as 'trial' | 'active', source: 'app_store' as const, productId: null,
    startsAt: e.latestPurchaseDate ?? new Date(0).toISOString(), expiresAt: e.expirationDate ?? null, graceUntil: null, willRenew: e.willRenew ?? false }];
}
