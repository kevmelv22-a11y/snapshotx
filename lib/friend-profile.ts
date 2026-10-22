/** Snapchat "Vriendschapsprofiel": tap a friend's avatar/name in a 1:1 chat (or in Vrienden) to see who they are
 *  and what you share — snapscore, streak, friends-since, shared groups, active story — with quick actions.
 *  Pure helpers; the screen (app/friend/[id].tsx) does the I/O. */
import type { StreakState } from './chat-features';

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAY = 86400000;

/** "Vrienden sinds 3 oktober 2026" (local date), "Sinds vandaag vrienden" under a day, null when unknown. */
export function friendsSinceLabel(iso: string | null | undefined, now: number, offsetMin = 0): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  if (now - t < DAY && new Date(t + offsetMin * 60000).getUTCDate() === new Date(now + offsetMin * 60000).getUTCDate()) return 'Sinds vandaag vrienden';
  const d = new Date(t + offsetMin * 60000);
  return `Vrienden sinds ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** Snapscore with Dutch thousands separators: 84732 → "84.732". */
export function formatScore(n: number | null | undefined): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
/** "🔥 12 dagen reeks" (+ ⌛ when at risk); null without a streak. */
export function streakChip(s: StreakState | null | undefined, fire = '🔥', hourglass = '⌛'): string | null {
  if (!s || s.count < 1) return null;
  return `${fire} ${s.count} ${s.count === 1 ? 'dag' : 'dagen'} reeks${s.atRisk ? ` ${hourglass}` : ''}`;
}
export type MemberRow = { thread_id: string; user_id: string };
export type ThreadRow = { id: string; title: string | null; is_group?: boolean | null };
export type SharedChats = { directId: string | null; groups: { id: string; title: string; memberCount: number }[] };
/** From the member rows of MY threads: the 1:1 thread with `friend` (exactly us two, no group name) and the groups
 *  we are both in (named, flagged as group, or 3+ members), sorted by name. Unnamed groups get member first names. */
export function sharedChats(members: readonly MemberRow[], threads: readonly ThreadRow[], me: string, friend: string, nameOf: (id: string) => string): SharedChats {
  const byThread = new Map<string, Set<string>>();
  for (const m of members) (byThread.get(m.thread_id) ?? byThread.set(m.thread_id, new Set()).get(m.thread_id)!).add(m.user_id);
  const meta = new Map(threads.map(t => [t.id, t]));
  let directId: string | null = null;
  const groups: SharedChats['groups'] = [];
  for (const [id, set] of byThread) {
    if (!set.has(me) || !set.has(friend)) continue;
    const t = meta.get(id), title = (t?.title ?? '').trim();
    const isGroup = !!t?.is_group || !!title || set.size > 2;
    if (!isGroup) { directId ??= id; continue; }
    const fallback = [...set].filter(u => u !== me).map(u => nameOf(u).split(/\s+/)[0]).sort().join(', ');
    groups.push({ id, title: title || fallback || 'Groep', memberCount: set.size });
  }
  groups.sort((a, b) => a.title.localeCompare(b.title, 'nl'));
  return { directId, groups };
}
/** "Weekend crew · 5 leden" */
export function groupLine(g: { title: string; memberCount: number }): string { return `${g.title} · ${g.memberCount} leden`; }
/** "1 gedeelde groep" / "3 gedeelde groepen" / null */
export function sharedGroupsTitle(n: number): string | null { return n < 1 ? null : `${n} gedeelde ${n === 1 ? 'groep' : 'groepen'}`; }
