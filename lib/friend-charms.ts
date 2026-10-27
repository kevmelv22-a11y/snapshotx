/** Snapchat "Charms" on the Vriendschapsprofiel: little cards that celebrate what you two share — your BFF status,
 *  your Snapstreak, your friendship anniversary, chatting a lot, chatting at night, groups you share and chats you
 *  saved. Computed on the device from data the profile already loads (no extra backend). Pure + unit-tested;
 *  the screen (app/friend/[id].tsx) renders the cards and the detail sheet. */
import type { RelationKind } from './friend-emojis';

const DAY = 86400000;
export type CharmId = 'relation' | 'streak' | 'anniversary' | 'chatty' | 'night_owls' | 'groups' | 'savers';
export type Charm = { id: CharmId; emoji: string; title: string; subtitle: string; description: string; colors: [string, string] };
/** One message of the 1:1 chat (system lines are ignored). */
export type CharmMessage = { sender_id: string; kind?: string | null; created_at: string };
export type CharmInput = {
  me: string; friend: string; now: number; offsetMin?: number;
  /** Friendship created_at (ISO) or null when unknown / not friends. */
  friendsSince?: string | null;
  relation?: RelationKind | null;
  streak?: number;
  /** Recent 1:1 messages (any order). */
  messages?: readonly CharmMessage[];
  sharedGroups?: number;
  savedCount?: number;
};

export const CHATTY_WINDOW_DAYS = 7;
export const CHATTY_MIN_TOTAL = 15;
export const CHATTY_MIN_EACH = 5;
export const NIGHT_WINDOW_DAYS = 30;
/** Local hours that count as "night" (00:00–04:59). */
export const NIGHT_HOURS: readonly [number, number] = [0, 5];
export const ANNIVERSARY_SOON_DAYS = 7;
export const STREAK_LEGEND = 100;

const RELATION: Record<RelationKind, { emoji: string; title: string; description: string; colors: [string, string] }> = {
  super_bff: { emoji: '💕', title: "Super BFF's", description: 'Jullie zijn al 2 maanden op rij elkaars #1 beste vriend.', colors: ['#FF5FA2', '#B0187A'] },
  bffs: { emoji: '❤️', title: "BFF's", description: 'Jullie zijn al 2 weken op rij elkaars #1 beste vriend.', colors: ['#FF4D5E', '#9C1730'] },
  bff: { emoji: '💛', title: 'Beste vrienden #1', description: 'Met niemand snap en chat je meer dan met deze vriend.', colors: ['#FFD43B', '#C77C00'] },
  best_friend: { emoji: '😊', title: 'Beste vrienden', description: 'Een van je beste vrienden: jullie snappen en chatten veel met elkaar.', colors: ['#FFB547', '#B4501C'] },
  new_friend: { emoji: '👶', title: 'Nieuwe vrienden', description: 'Jullie zijn minder dan een week vrienden. Welkom!', colors: ['#7AD3FF', '#2A6FDB'] },
};

/** Local calendar parts of a timestamp (offsetMin = minutes east of UTC, e.g. 60 for CET). */
function local(ms: number, offsetMin: number) { const d = new Date(ms + offsetMin * 60000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours() }; }
const dayNo = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / DAY);
/** Anniversary date in year y; a 29 February friendship celebrates on 28 February in non-leap years. */
function anniversaryDay(y: number, m: number, d: number) { const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return dayNo(y, m, Math.min(d, last)); }

/** Full years of friendship and days until the next anniversary (0 = today), by local calendar date. */
export function friendshipYears(sinceIso: string | null | undefined, now: number, offsetMin = 0): { years: number; daysToNext: number } | null {
  const t = sinceIso ? Date.parse(sinceIso) : NaN;
  if (!Number.isFinite(t) || t > now) return null;
  const s = local(t, offsetMin), n = local(now, offsetMin), today = dayNo(n.y, n.m, n.d);
  let years = n.y - s.y;
  if (anniversaryDay(n.y, s.m, s.d) > today) years -= 1;
  let next = anniversaryDay(n.y, s.m, s.d);
  if (next < today) next = anniversaryDay(n.y + 1, s.m, s.d);
  return { years: Math.max(0, years), daysToNext: next - today };
}
const jaar = (n: number) => `${n} jaar`;
const dagen = (n: number) => `${n} ${n === 1 ? 'dag' : 'dagen'}`;

/** Anniversary charm: from 1 year on ("2 jaar vrienden"), or the week before the first one ("Over 3 dagen 1 jaar vrienden"). */
export function anniversaryCharm(sinceIso: string | null | undefined, now: number, offsetMin = 0): Charm | null {
  const f = friendshipYears(sinceIso, now, offsetMin);
  if (!f) return null;
  const isToday = f.daysToNext === 0 && f.years >= 1;
  const soon = !isToday && f.daysToNext <= ANNIVERSARY_SOON_DAYS && f.daysToNext > 0;
  if (f.years < 1 && !soon) return null;
  const subtitle = isToday ? `Vandaag ${jaar(f.years)} vrienden 🎉` : soon ? `Over ${dagen(f.daysToNext)} ${jaar(f.years + 1)} vrienden` : `${jaar(f.years)} vrienden`;
  return { id: 'anniversary', emoji: '🎂', title: 'Jubileum', subtitle, colors: ['#C77DFF', '#5A189A'],
    description: isToday ? `Gefeliciteerd! Jullie zijn vandaag precies ${jaar(f.years)} vrienden op Snapshot X.` : soon ? `Over ${dagen(f.daysToNext)} zijn jullie ${jaar(f.years + 1)} vrienden op Snapshot X. Stuur dan een snap!` : `Jullie zijn al ${jaar(f.years)} vrienden op Snapshot X.` };
}

/** Counts per side in [now - days, now], ignoring system lines and future rows. */
function recent(msgs: readonly CharmMessage[], me: string, friend: string, now: number, days: number, pick?: (ms: number) => boolean) {
  let mine = 0, theirs = 0;
  for (const x of msgs) {
    if (x.kind === 'system') continue;
    const t = Date.parse(x.created_at);
    if (!Number.isFinite(t) || t > now || now - t > days * DAY) continue;
    if (pick && !pick(t)) continue;
    if (x.sender_id === me) mine++; else if (x.sender_id === friend) theirs++;
  }
  return { mine, theirs };
}
/** Kletskousen: ≥ 15 chats/snaps in the last 7 days and both sent ≥ 5 (mutual, like Snapchat best friends). */
export function isChatty(msgs: readonly CharmMessage[], me: string, friend: string, now: number): boolean {
  const c = recent(msgs, me, friend, now, CHATTY_WINDOW_DAYS);
  return c.mine + c.theirs >= CHATTY_MIN_TOTAL && c.mine >= CHATTY_MIN_EACH && c.theirs >= CHATTY_MIN_EACH;
}
/** Nachtbrakers: both of you sent something between 00:00 and 04:59 (local) in the last 30 days. */
export function isNightOwls(msgs: readonly CharmMessage[], me: string, friend: string, now: number, offsetMin = 0): boolean {
  const c = recent(msgs, me, friend, now, NIGHT_WINDOW_DAYS, t => { const h = local(t, offsetMin).h; return h >= NIGHT_HOURS[0] && h < NIGHT_HOURS[1]; });
  return c.mine > 0 && c.theirs > 0;
}

/** All earned charms, in Snapchat-like order: relationship, streak, anniversary, chatting, night, groups, saved. */
export function friendCharms(i: CharmInput): Charm[] {
  const out: Charm[] = [], off = i.offsetMin ?? 0, msgs = i.messages ?? [];
  if (i.relation && RELATION[i.relation]) { const r = RELATION[i.relation]; out.push({ id: 'relation', emoji: r.emoji, title: r.title, subtitle: i.relation === 'new_friend' ? 'Net bevriend' : 'Vriend-emoji', description: r.description, colors: r.colors }); }
  const streak = Math.max(0, Math.floor(i.streak ?? 0));
  if (streak >= 1) out.push(streak >= STREAK_LEGEND
    ? { id: 'streak', emoji: '💯', title: 'Streak-legendes', subtitle: `${dagen(streak)} op rij`, description: `Jullie hebben al ${dagen(streak)} op rij een Snapstreak. Legendarisch!`, colors: ['#FF8A00', '#B31217'] }
    : { id: 'streak', emoji: '🔥', title: 'Snapstreak', subtitle: `${dagen(streak)} op rij`, description: `Jullie sturen elkaar al ${dagen(streak)} op rij een snap. Snap elke dag om je streak te houden.`, colors: ['#FF9F43', '#C0392B'] });
  const ann = anniversaryCharm(i.friendsSince, i.now, off); if (ann) out.push(ann);
  if (isChatty(msgs, i.me, i.friend, i.now)) out.push({ id: 'chatty', emoji: '💬', title: 'Kletskousen', subtitle: 'Veel gechat deze week', description: 'Jullie hebben de afgelopen 7 dagen superveel met elkaar gechat en gesnapt.', colors: ['#3DDC97', '#0B7A55'] });
  if (isNightOwls(msgs, i.me, i.friend, i.now, off)) out.push({ id: 'night_owls', emoji: '🦉', title: 'Nachtbrakers', subtitle: "Chatten 's nachts", description: "Jullie hebben elkaar de afgelopen 30 dagen allebei 's nachts (tussen 00:00 en 05:00) een bericht gestuurd.", colors: ['#3A4BC9', '#141A4A'] });
  const g = Math.max(0, Math.floor(i.sharedGroups ?? 0));
  if (g >= 1) out.push({ id: 'groups', emoji: '👯', title: 'Groepsgenoten', subtitle: `Samen in ${g} ${g === 1 ? 'groep' : 'groepen'}`, description: `Jullie zitten samen in ${g} ${g === 1 ? 'groepschat' : 'groepschats'}.`, colors: ['#5EC8FF', '#1E5BB8'] });
  const sv = Math.max(0, Math.floor(i.savedCount ?? 0));
  if (sv >= 1) out.push({ id: 'savers', emoji: '📌', title: 'Bewaarders', subtitle: `${sv} ${sv === 1 ? 'chat' : 'chats'} opgeslagen`, description: `Jullie hebben ${sv} ${sv === 1 ? 'bericht' : 'berichten'} in jullie chat opgeslagen.`, colors: ['#A0A7B8', '#4A5164'] });
  return out;
}
/** "Charms · 4" section title; null without charms. */
export function charmsTitle(n: number): string | null { return n < 1 ? null : `Charms · ${n}`; }
