/** Server (public.sx_entitlements) entitlements merged with RevenueCat. Pure, no RN imports (runs under node --test). */
import { isEntitlementActive, type Entitlement, type EntitlementStatus, type Tier } from './plus';

export type SxEntitlementRow = { tier: string; status: string; source: string; product_id?: string | null; starts_at: string; expires_at: string | null; grace_until?: string | null; will_renew?: boolean | null };
const TIERS: readonly Tier[] = ['plus', 'family', 'lens', 'platinum', 'storage'];
const STATUSES: readonly EntitlementStatus[] = ['active', 'trial', 'grace', 'expired', 'revoked', 'refunded'];
const SOURCES: readonly Entitlement['source'][] = ['app_store', 'play', 'promo', 'staff'];
/** Same ranking as lib/plus.ts and app_private.sx_tier_rank: higher includes lower. */
const RANK: Record<Tier, number> = { storage: 0, plus: 1, family: 1, lens: 2, platinum: 3 };
/** Column list for the own-rows select (RLS: sx_entitlements_read_own). */
export const SX_ENTITLEMENT_COLUMNS = 'tier,status,source,product_id,starts_at,expires_at,grace_until,will_renew';

/** Map DB rows to the app's Entitlement shape; drops unknown tiers and rows that are not live at `now`. */
export function rowsToEntitlements(rows: readonly SxEntitlementRow[] | null | undefined, now: number): Entitlement[] {
  const out: Entitlement[] = [];
  for (const r of rows ?? []) {
    if (!r || !TIERS.includes(r.tier as Tier) || !STATUSES.includes(r.status as EntitlementStatus)) continue;
    const e: Entitlement = { tier: r.tier as Tier, status: r.status as EntitlementStatus, source: SOURCES.includes(r.source as Entitlement['source']) ? r.source as Entitlement['source'] : 'promo',
      productId: null, startsAt: r.starts_at, expiresAt: r.expires_at ?? null, graceUntil: r.grace_until ?? null, willRenew: !!r.will_renew };
    if (isEntitlementActive(e, now)) out.push(e);
  }
  return out;
}
/** RevenueCat + server entitlements, highest tier first (activeTier picks the max rank, so platinum beats plus). */
export function mergeEntitlements(rc: readonly Entitlement[], server: readonly Entitlement[], now: number): Entitlement[] {
  const all = [...rc, ...server].filter(e => isEntitlementActive(e, now));
  return all.sort((a, b) => RANK[b.tier] - RANK[a.tier]);
}
