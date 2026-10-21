/** Snapshot X+ (subscription) pure logic: plans, entitlement evaluation, feature gating and perk helpers.
 *  Client-side state is only a cache/UX hint. The source of truth must be the server (sx_entitlements, written
 *  only by a store-webhook Edge Function); never trust the client for anything security-relevant. */
export type PlanId = 'sx_plus_monthly' | 'sx_plus_yearly';
export type Plan = { id: PlanId; period: 'month' | 'year'; priceCents: number; currency: 'EUR'; title: string };
/** Reference prices (NL, oct 2026: comparable subscription €3,99/month). Yearly is our own proposal. Not real store product keys. */
export const PLANS: readonly Plan[] = [
  { id: 'sx_plus_monthly', period: 'month', priceCents: 399, currency: 'EUR', title: 'Maandelijks' },
  { id: 'sx_plus_yearly', period: 'year', priceCents: 3999, currency: 'EUR', title: 'Jaarlijks' },
];
export const getPlan = (id: string): Plan | undefined => PLANS.find(p => p.id === id);

/** "€ 3,99" style Dutch price. */
export function formatPrice(cents: number): string {
  const e = Math.floor(Math.abs(cents) / 100), c = Math.abs(cents) % 100;
  return `€${cents < 0 ? '-' : ''}${e},${String(c).padStart(2, '0')}`;
}
export function periodLabel(p: Plan): string { return p.period === 'month' ? 'per maand' : 'per jaar'; }
/** Yearly saving vs 12× monthly, rounded down to whole percent. */
export function yearlySavingPercent(plans: readonly Plan[] = PLANS): number {
  const m = plans.find(p => p.period === 'month'), y = plans.find(p => p.period === 'year');
  if (!m || !y || m.priceCents <= 0) return 0;
  return Math.max(0, Math.floor((1 - y.priceCents / (m.priceCents * 12)) * 100));
}
export function monthlyEquivalentCents(p: Plan): number { return p.period === 'year' ? Math.round(p.priceCents / 12) : p.priceCents; }

export type EntitlementStatus = 'active' | 'grace' | 'expired' | 'revoked' | 'refunded';
export type Entitlement = { tier: 'plus'; status: EntitlementStatus; source: 'mock' | 'app_store' | 'play' | 'promo'; productId: PlanId | null; startsAt: string; expiresAt: string | null; graceUntil?: string | null; willRenew?: boolean };

/** True when the entitlement grants X+ at `now`. Revoked/refunded never; grace until graceUntil; null expiresAt = lifetime promo. */
export function isEntitlementActive(e: Entitlement | null | undefined, now: number): boolean {
  if (!e || e.tier !== 'plus') return false;
  if (e.status === 'revoked' || e.status === 'refunded') return false;
  if (Date.parse(e.startsAt) > now) return false;
  if (e.expiresAt === null) return e.status === 'active';
  if (Date.parse(e.expiresAt) > now) return true;
  return !!e.graceUntil && Date.parse(e.graceUntil) > now;
}
export function isPlus(ents: readonly (Entitlement | null | undefined)[] | Entitlement | null | undefined, now: number): boolean {
  const list = Array.isArray(ents) ? ents : [ents];
  return list.some(e => isEntitlementActive(e as Entitlement, now));
}
/** Status line for settings. */
export function entitlementLabel(e: Entitlement | null | undefined, now: number): string {
  if (!isEntitlementActive(e, now) || !e) return 'Geen X+';
  if (e.expiresAt === null) return 'X+ actief';
  const d = new Date(Date.parse(e.expiresAt) > now ? e.expiresAt : e.graceUntil!);
  const date = `${d.getUTCDate()}-${d.getUTCMonth() + 1}-${d.getUTCFullYear()}`;
  if (Date.parse(e.expiresAt) <= now) return `Betaling mislukt, toegang tot ${date}`;
  return e.willRenew === false ? `Loopt af op ${date}` : `Verlengt op ${date}`;
}
/** Adds one period to a start time (calendar month/year, UTC). */
export function addPeriod(startMs: number, period: Plan['period']): string {
  const d = new Date(startMs);
  if (period === 'month') d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

export type PlusFeature = 'badge' | 'app_icon' | 'story_rewatch' | 'priority_replies' | 'chat_wallpaper' | 'bff_pin';
export const FEATURES: readonly { id: PlusFeature; title: string; description: string; icon: string }[] = [
  { id: 'badge', title: 'X+-badge', description: 'Een badge naast je naam op je profiel', icon: 'sparkles' },
  { id: 'app_icon', title: 'Eigen app-icoon', description: 'Kies een ander icoon voor je beginscherm', icon: 'apps' },
  { id: 'story_rewatch', title: 'Herbekeken-indicator', description: 'Zie hoeveel vrienden je verhaal opnieuw bekeken', icon: 'eye' },
  { id: 'priority_replies', title: 'Voorrang bij reacties', description: 'Jouw reacties op verhalen staan bovenaan', icon: 'arrow-up-circle' },
  { id: 'chat_wallpaper', title: 'Chat-achtergronden', description: 'Een eigen achtergrond per chat', icon: 'image' },
  { id: 'bff_pin', title: 'Vaste #1 beste vriend', description: 'Pin één vriend bovenaan je lijst', icon: 'pin' },
];
/** Feature gating. All features currently require X+; kept as a function so tiers can diverge later. */
export function canUse(_f: PlusFeature, plus: boolean): boolean { return plus; }

// --- App icons -----------------------------------------------------------------------------------
export type AppIconId = 'default' | 'galaxy' | 'neon' | 'zon' | 'nacht';
export const APP_ICONS: readonly { id: AppIconId; label: string; colors: [string, string]; plusOnly: boolean }[] = [
  { id: 'default', label: 'Standaard', colors: ['#AE16C7', '#4298FF'], plusOnly: false },
  { id: 'galaxy', label: 'Galaxy', colors: ['#0D0618', '#B713D5'], plusOnly: true },
  { id: 'neon', label: 'Neon', colors: ['#00F5D4', '#FF5B95'], plusOnly: true },
  { id: 'zon', label: 'Zon', colors: ['#FFE436', '#FF6B6B'], plusOnly: true },
  { id: 'nacht', label: 'Nacht', colors: ['#161820', '#30333D'], plusOnly: true },
];
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
