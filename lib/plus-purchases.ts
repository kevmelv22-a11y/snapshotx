/** Purchase abstraction for Snapshot X+. Only a MOCK provider exists: real IAP (RevenueCat / expo-iap) needs a dev build
 *  and paid store accounts. A real provider must implement the same interface and the server must validate receipts. */
import { addPeriod, getPlan, type Entitlement, type PlanId } from './plus';

export type PurchaseResult = { ok: true; entitlement: Entitlement } | { ok: false; reason: 'cancelled' | 'unknown_product' | 'error'; message: string };
export interface PurchaseProvider {
  readonly name: string;
  purchase(planId: PlanId): Promise<PurchaseResult>;
  restore(): Promise<Entitlement[]>;
  cancelRenewal(): Promise<void>;
}
export type MockOptions = { now?: () => number; fail?: 'cancelled' | 'error' | null; initial?: Entitlement[] };

/** In-memory mock store. Nothing leaves the device; "restore" returns what was bought on this instance. */
export function createMockProvider(opts: MockOptions = {}): PurchaseProvider & { readonly owned: Entitlement[] } {
  const now = opts.now ?? Date.now;
  const owned: Entitlement[] = [...(opts.initial ?? [])];
  return {
    name: 'mock', owned,
    async purchase(planId) {
      const plan = getPlan(planId);
      if (!plan) return { ok: false, reason: 'unknown_product', message: 'Onbekend abonnement' };
      if (opts.fail === 'cancelled') return { ok: false, reason: 'cancelled', message: 'Aankoop geannuleerd' };
      if (opts.fail === 'error') return { ok: false, reason: 'error', message: 'Aankoop mislukt, probeer het later opnieuw' };
      const t = now();
      const e: Entitlement = { tier: 'plus', status: 'active', source: 'mock', productId: planId, startsAt: new Date(t).toISOString(), expiresAt: addPeriod(t, plan.period), graceUntil: null, willRenew: true };
      owned.splice(0, owned.length, e);
      return { ok: true, entitlement: e };
    },
    async restore() { return owned.map(e => ({ ...e })); },
    async cancelRenewal() { for (const e of owned) e.willRenew = false; },
  };
}
