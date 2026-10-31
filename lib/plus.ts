/** Snapshot X+ (subscription) pure logic: plans, entitlement evaluation, feature gating and perk helpers.
 *  Client-side state is only a cache/UX hint. The source of truth must be the server (sx_entitlements, written
 *  only by a store-webhook Edge Function); never trust the client for anything security-relevant. */
export type Tier = 'plus' | 'family' | 'lens' | 'platinum' | 'storage';
export type PlanId =
  | 'sx_plus_monthly' | 'sx_plus_yearly' | 'sx_family_monthly' | 'sx_lens_monthly'
  | 'sx_platinum_monthly' | 'sx_platinum_yearly' | 'sx_storage_monthly' | 'sx_storage_yearly';
export type Plan = { id: PlanId; tier: Tier; period: 'month' | 'year'; priceCents: number; currency: 'EUR'; title: string; trialDays: number };
/** Mirrors Snapchat's Oct 2026 lineup (Snapchat+, Family, Lens+, Platinum, Memories Storage) at ~10–25% below Snapchat's EU prices
 *  (NL App Store: Snapchat+ €3,99/mnd, Family €7,99, Memories €1,99; DE: Lens+ €7,99, Platinum €13,49, Snapchat+ €44,99/jaar).
 *  Lens+ and Family are monthly-only, as at Snapchat. Not real store product keys. */
export const PLANS: readonly Plan[] = [
  { id: 'sx_plus_monthly', tier: 'plus', period: 'month', priceCents: 349, currency: 'EUR', title: 'Maandelijks', trialDays: 7 },
  { id: 'sx_plus_yearly', tier: 'plus', period: 'year', priceCents: 2999, currency: 'EUR', title: 'Jaarlijks', trialDays: 7 },
  { id: 'sx_family_monthly', tier: 'family', period: 'month', priceCents: 599, currency: 'EUR', title: 'Maandelijks', trialDays: 0 },
  { id: 'sx_lens_monthly', tier: 'lens', period: 'month', priceCents: 699, currency: 'EUR', title: 'Maandelijks', trialDays: 0 },
  { id: 'sx_platinum_monthly', tier: 'platinum', period: 'month', priceCents: 1199, currency: 'EUR', title: 'Maandelijks', trialDays: 0 },
  { id: 'sx_platinum_yearly', tier: 'platinum', period: 'year', priceCents: 10999, currency: 'EUR', title: 'Jaarlijks', trialDays: 0 },
  { id: 'sx_storage_monthly', tier: 'storage', period: 'month', priceCents: 179, currency: 'EUR', title: 'Maandelijks', trialDays: 0 },
  { id: 'sx_storage_yearly', tier: 'storage', period: 'year', priceCents: 1799, currency: 'EUR', title: 'Jaarlijks', trialDays: 0 },
];
export const getPlan = (id: string): Plan | undefined => PLANS.find(p => p.id === id);
export const plansFor = (tier: Tier): Plan[] => PLANS.filter(p => p.tier === tier);

export type TierInfo = { id: Tier; name: string; tagline: string; storage: string; seats: number; perks: string[] };
/** Tier ladder. Each paid tier includes everything of the one before (Lens+ ⊃ X+, Platinum ⊃ Lens+). */
export const TIERS: readonly TierInfo[] = [
  { id: 'plus', name: 'Snapshot X+', tagline: 'Alle Snapshot X+-functies voor jou', storage: '250 GB', seats: 1, perks: ['Alle Snapshot X+-functies', '250 GB opslag voor Herinneringen'] },
  { id: 'family', name: 'Snapshot Family', tagline: 'Snapshot X+ voor jou en 2 anderen', storage: '250 GB', seats: 3, perks: ['Alle Snapshot X+-functies voor 3 personen', '250 GB opslag (beheerder)'] },
  { id: 'lens', name: 'Snapshot X Lens', tagline: 'Snapshot X+ plus exclusieve AI-lenzen', storage: '250 GB', seats: 1, perks: ['Alles van Snapshot X+', 'Exclusieve AI-lenzen, elke week nieuw', 'Imagine-lens: maak een beeld met tekst'] },
  { id: 'platinum', name: 'Snapshot Platinum', tagline: 'Alles, zonder advertenties', storage: '5 TB', seats: 1, perks: ['Alles van Snapshot X Lens', 'Geen gesponsorde snaps, verhaal- of lensadvertenties', '5 TB opslag voor Herinneringen'] },
  { id: 'storage', name: 'Herinneringen 100 GB', tagline: 'Alleen extra opslag', storage: '100 GB', seats: 1, perks: ['100 GB opslag voor Herinneringen', 'Geen Snapshot X+-functies'] },
];
export const tierInfo = (t: Tier): TierInfo => TIERS.find(x => x.id === t)!;
export const FREE_STORAGE = '5 GB';
const RANK: Record<Tier, number> = { storage: 0, plus: 1, family: 1, lens: 2, platinum: 3 };

/** "€3,49" style Dutch price. */
export function formatPrice(cents: number): string {
  const e = Math.floor(Math.abs(cents) / 100), c = Math.abs(cents) % 100;
  return `€${cents < 0 ? '-' : ''}${e},${String(c).padStart(2, '0')}`;
}
export function periodLabel(p: Plan): string { return p.period === 'month' ? 'per maand' : 'per jaar'; }
/** Yearly saving vs 12× monthly for one tier, rounded down to whole percent. */
export function yearlySavingPercent(tier: Tier = 'plus', plans: readonly Plan[] = PLANS): number {
  const m = plans.find(p => p.tier === tier && p.period === 'month'), y = plans.find(p => p.tier === tier && p.period === 'year');
  if (!m || !y || m.priceCents <= 0) return 0;
  return Math.max(0, Math.floor((1 - y.priceCents / (m.priceCents * 12)) * 100));
}
export function monthlyEquivalentCents(p: Plan): number { return p.period === 'year' ? Math.round(p.priceCents / 12) : p.priceCents; }

export type EntitlementStatus = 'active' | 'trial' | 'grace' | 'expired' | 'revoked' | 'refunded';
export type Entitlement = { tier: Tier; status: EntitlementStatus; source: 'mock' | 'app_store' | 'play' | 'promo' | 'staff'; productId: PlanId | null; startsAt: string; expiresAt: string | null; graceUntil?: string | null; willRenew?: boolean };

/** True when the entitlement is live at `now`. Revoked/refunded never; grace until graceUntil; null expiresAt = lifetime promo. */
export function isEntitlementActive(e: Entitlement | null | undefined, now: number): boolean {
  if (!e) return false;
  if (e.status === 'revoked' || e.status === 'refunded' || e.status === 'expired') return false;
  if (Date.parse(e.startsAt) > now) return false;
  if (e.expiresAt === null) return e.status === 'active';
  if (Date.parse(e.expiresAt) > now) return true;
  return !!e.graceUntil && Date.parse(e.graceUntil) > now;
}
const asList = (ents: readonly (Entitlement | null | undefined)[] | Entitlement | null | undefined) => (Array.isArray(ents) ? ents : [ents]) as (Entitlement | null | undefined)[];
/** Highest active tier, or null. */
export function activeTier(ents: readonly (Entitlement | null | undefined)[] | Entitlement | null | undefined, now: number): Tier | null {
  let best: Tier | null = null;
  for (const e of asList(ents)) if (e && isEntitlementActive(e, now) && (best === null || RANK[e.tier] > RANK[best])) best = e.tier;
  return best;
}
/** True when any X+ tier (not storage-only) is active. */
export function isPlus(ents: readonly (Entitlement | null | undefined)[] | Entitlement | null | undefined, now: number): boolean {
  const t = activeTier(ents, now); return t !== null && t !== 'storage';
}
/** Status line for settings. */
export function entitlementLabel(e: Entitlement | null | undefined, now: number): string {
  if (!isEntitlementActive(e, now) || !e) return 'Geen abonnement';
  const name = tierInfo(e.tier).name;
  if (e.expiresAt === null) return `${name} actief`;
  const d = new Date(Date.parse(e.expiresAt) > now ? e.expiresAt : e.graceUntil!);
  const date = `${d.getUTCDate()}-${d.getUTCMonth() + 1}-${d.getUTCFullYear()}`;
  if (Date.parse(e.expiresAt) <= now) return `Betaling mislukt, toegang tot ${date}`;
  if (e.status === 'trial') return e.willRenew === false ? `Proefperiode stopt op ${date}` : `Gratis tot ${date}, daarna betaald`;
  return e.willRenew === false ? `Loopt af op ${date}` : `Verlengt op ${date}`;
}
/** Adds one period (or n days) to a start time (calendar month/year, UTC). */
export function addPeriod(startMs: number, period: Plan['period'] | { days: number }): string {
  const d = new Date(startMs);
  if (typeof period === 'object') d.setUTCDate(d.getUTCDate() + period.days);
  else if (period === 'month') d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}
/** Trial only for X+ plans and only if this account never had any paid/trial entitlement before. */
export function trialEligible(plan: Plan, history: readonly Entitlement[]): boolean {
  return plan.trialDays > 0 && !history.some(e => e.source !== 'promo');
}

export type PlusFeature = 'badge' | 'app_icon' | 'story_rewatch' | 'priority_replies' | 'bff_pin' | 'ai_lenses' | 'no_ads' | 'memories_5tb';
export const FEATURES: readonly { id: PlusFeature; title: string; description: string; icon: string; minTier: Tier }[] = [
  { id: 'badge', title: 'Snapshot X+-badge', description: 'Een badge naast je naam op je profiel', icon: 'sparkles', minTier: 'plus' },
  { id: 'app_icon', title: 'Eigen app-icoon', description: 'Kies een ander icoon voor je beginscherm', icon: 'apps', minTier: 'plus' },
  { id: 'story_rewatch', title: 'Herbekeken-indicator', description: 'Zie hoeveel vrienden je verhaal opnieuw bekeken', icon: 'eye', minTier: 'plus' },
  { id: 'priority_replies', title: 'Voorrang bij reacties', description: 'Jouw reacties op verhalen staan bovenaan', icon: 'arrow-up-circle', minTier: 'plus' },
  { id: 'bff_pin', title: 'Vaste #1 beste vriend', description: 'Pin één vriend bovenaan je lijst', icon: 'pin', minTier: 'plus' },
  { id: 'ai_lenses', title: 'Exclusieve AI-lenzen', description: 'Honderden extra lenzen, waaronder de Imagine-lens', icon: 'color-wand', minTier: 'lens' },
  { id: 'no_ads', title: 'Geen advertenties', description: 'Geen gesponsorde snaps, verhaal- of lensadvertenties', icon: 'ban', minTier: 'platinum' },
  { id: 'memories_5tb', title: '5 TB Herinneringen', description: 'Bewaar praktisch al je snaps', icon: 'cloud', minTier: 'platinum' },
];
/** Feature gating by tier. Pass a Tier (or null), or a boolean for legacy "has any X+" checks (= plus-level features only). */
export function canUse(f: PlusFeature, who: Tier | null | boolean): boolean {
  const feat = FEATURES.find(x => x.id === f); if (!feat) return false;
  const t: Tier | null = typeof who === 'boolean' ? (who ? 'plus' : null) : who;
  if (!t || t === 'storage') return false;
  return RANK[t] >= RANK[feat.minTier];
}
export const featuresFor = (t: Tier) => FEATURES.filter(f => canUse(f.id, t));

// --- App icons -----------------------------------------------------------------------------------
export type AppIconId = 'default' | 'bliksem' | 'vuurijs' | 'ringen' | 'lens' | 'schild' | 'neonspook' | 'glas' | 'gloed' | 'snapx' | 'boog';
/** native = PascalCase name registered with expo-alternate-app-icons in app.json (null = primary icon). */
export const APP_ICONS: readonly { id: AppIconId; label: string; native: string | null; plusOnly: boolean }[] = [
  { id: 'default', label: 'Standaard', native: null, plusOnly: false },
  { id: 'bliksem', label: 'Bliksem X', native: 'Bliksem', plusOnly: true },
  { id: 'vuurijs', label: 'Vuur & IJs', native: 'VuurIjs', plusOnly: true },
  { id: 'ringen', label: 'Ringen', native: 'Ringen', plusOnly: true },
  { id: 'lens', label: 'Lens', native: 'Lens', plusOnly: true },
  { id: 'schild', label: 'Schild', native: 'Schild', plusOnly: true },
  { id: 'neonspook', label: 'Neon Spook', native: 'NeonSpook', plusOnly: true },
  { id: 'glas', label: 'Glas', native: 'Glas', plusOnly: true },
  { id: 'gloed', label: 'Gloed', native: 'Gloed', plusOnly: true },
  { id: 'snapx', label: 'Snap X', native: 'SnapX', plusOnly: true },
  { id: 'boog', label: 'Boog', native: 'Boog', plusOnly: true },
];
export function appIconInfo(id: string) { return APP_ICONS.find(x => x.id === id) ?? APP_ICONS[0]; }
/** Icon actually shown: a plus-only choice falls back to default once X+ lapses. */
export function effectiveAppIcon(choice: string | null | undefined, plus: boolean): AppIconId {
  const i = APP_ICONS.find(x => x.id === choice);
  if (!i || (i.plusOnly && !plus)) return 'default';
  return i.id;
}

// --- Chat wallpapers -----------------------------------------------------------------------------
export type WallpaperId = 'none' | 'sterren' | 'aurora' | 'oceaan' | 'roze' | 'grafiet';
export const WALLPAPERS: readonly { id: WallpaperId; label: string; colors: [string, string] }[] = [
  { id: 'none', label: 'Geen', colors: ['#08090E', '#08090E'] },
  { id: 'sterren', label: 'Sterren', colors: ['#0D0618', '#2A0F45'] },
  { id: 'aurora', label: 'Aurora', colors: ['#06352F', '#3B1361'] },
  { id: 'oceaan', label: 'Oceaan', colors: ['#06213D', '#0B4F7A'] },
  { id: 'roze', label: 'Roze', colors: ['#3D0622', '#7A0D4F'] },
  { id: 'grafiet', label: 'Grafiet', colors: ['#161820', '#30333D'] },
];
/** Wallpaper for a chat: per-thread choice, else 'none'. Non-X+ always 'none' (choices are kept for re-subscribe). */
export function wallpaperFor(threadId: string, choices: Record<string, string>, plus: boolean): WallpaperId {
  if (!plus) return 'none';
  const w = WALLPAPERS.find(x => x.id === choices[threadId]);
  return w ? w.id : 'none';
}

// --- Story rewatch -------------------------------------------------------------------------------
export type StoryView = { viewerId: string; storyId: string; at: string };
/** Number of distinct viewers who viewed a story more than once. Owner's own views are ignored. */
export function rewatchCount(views: readonly StoryView[], storyId: string, ownerId?: string): number {
  const n = new Map<string, number>();
  for (const v of views) if (v.storyId === storyId && v.viewerId !== ownerId) n.set(v.viewerId, (n.get(v.viewerId) ?? 0) + 1);
  let c = 0; for (const k of n.values()) if (k > 1) c++;
  return c;
}
/** Indicator text, or null when hidden (no X+ or zero rewatches). */
export function rewatchLabel(count: number, plus: boolean): string | null {
  if (!plus || count <= 0) return null;
  return count === 1 ? '1 vriend keek opnieuw' : `${count} vrienden keken opnieuw`;
}

// --- Priority story replies ----------------------------------------------------------------------
export type StoryReply = { id: string; senderId: string; at: string; senderPlus: boolean };
/** X+ senders first, then newest first; stable for equal keys. */
export function sortStoryReplies<T extends StoryReply>(replies: readonly T[]): T[] {
  return replies.map((r, i) => ({ r, i })).sort((a, b) => (Number(b.r.senderPlus) - Number(a.r.senderPlus)) || (Date.parse(b.r.at) - Date.parse(a.r.at)) || (a.i - b.i)).map(x => x.r);
}

// --- Best friend pin -----------------------------------------------------------------------------
/** Moves the pinned friend to position 0 when X+ is active and the friend is in the list. Otherwise unchanged order. */
export function applyBffPin<T>(list: readonly T[], idOf: (t: T) => string, pinnedId: string | null | undefined, plus: boolean): T[] {
  const out = [...list];
  if (!plus || !pinnedId) return out;
  const i = out.findIndex(t => idOf(t) === pinnedId);
  if (i <= 0) return out;
  const [p] = out.splice(i, 1); out.unshift(p);
  return out;
}
export function isPinnedBff(id: string, pinnedId: string | null | undefined, plus: boolean): boolean { return plus && !!pinnedId && id === pinnedId; }
