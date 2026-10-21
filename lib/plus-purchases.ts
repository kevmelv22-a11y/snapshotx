/** Purchase abstraction for Snapshot X subscriptions. Only a MOCK provider exists: real IAP (RevenueCat / expo-iap) needs a dev build
 *  and paid store accounts. A real provider must implement the same interface and the server must validate receipts. */
import { addPeriod, getPlan, trialEligible, type Entitlement, type PlanId } from './plus';

export type PurchaseResult = { ok: true; entitlement: Entitlement; trial: boolean } | { ok: false; reason: 'cancelled' | 'unknown_product' | 'error'; message: string };
export interface PurchaseProvider {
  readonly name: string;
  /** Buy or switch to a plan. Switching replaces the current subscription entitlement (storage add-on is separate). */
  purchase(planId: PlanId): Promise<PurchaseResult>;
  restore(): Promise<Entitlement[]>;
  /** Turn off auto-renew; access remains until expiresAt (trial: until trial end, then nothing is charged). */
  cancelRenewal(planId?: PlanId): Promise<void>;
  resumeRenewal(planId?: PlanId): Promise<void>;
}
export type MockOptions = { now?: () => number; fail?: 'cancelled' | 'error' | null; initial?: Entitlement[] };

/** In-memory mock store. Nothing leaves the device; "restore" returns what was bought on this instance. */
export function createMockProvider(opts: MockOptions = {}): PurchaseProvider & { readonly owned: Entitlement[] } {
  const now = opts.now ?? Date.now;
  const owned: Entitlement[] = [...(opts.initial ?? [])];
  const history: Entitlement[] = [...owned];
  const pick = (planId?: PlanId) => owned.filter(e => !planId || e.productId === planId);
  return {
    name: 'mock', owned,
    async purchase(planId) {
      const plan = getPlan(planId);
      if (!plan) return { ok: false, reason: 'unknown_product', message: 'Onbekend abonnement' };
      if (opts.fail === 'cancelled') return { ok: false, reason: 'cancelled', message: 'Aankoop geannuleerd' };
      if (opts.fail === 'error') return { ok: false, reason: 'error', message: 'Aankoop mislukt, probeer het later opnieuw' };
      const t = now(), trial = trialEligible(plan, history);
      const e: Entitlement = { tier: plan.tier, status: trial ? 'trial' : 'active', source: 'mock', productId: planId, startsAt: new Date(t).toISOString(),
        expiresAt: addPeriod(t, trial ? { days: plan.trialDays } : plan.period), graceUntil: null, willRenew: true };
      const isStorage = plan.tier === 'storage';
      for (let i = owned.length - 1; i >= 0; i--) if ((owned[i].tier === 'storage') === isStorage) owned.splice(i, 1);
      owned.push(e); history.push(e);
      return { ok: true, entitlement: e, trial };
    },
    async restore() { return owned.map(e => ({ ...e })); },
    async cancelRenewal(planId) { for (const e of pick(planId)) e.willRenew = false; },
    async resumeRenewal(planId) { for (const e of pick(planId)) e.willRenew = true; },
  };
}
