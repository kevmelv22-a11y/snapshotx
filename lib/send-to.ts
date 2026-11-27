/** Snapchat "Verzenden naar" sheet: search, Mijn verhaal + friends in one selection, blue send bar summary. */
export type SendFriend = { id: string; display_name: string; username?: string | null };
export const STORY_TARGET = 'story:mine';

export function filterFriends<T extends SendFriend>(list: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('nl');
  const sorted = [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, 'nl'));
  const handle = q.replace(/^@/, '');
  return q ? sorted.filter(f => f.display_name.toLocaleLowerCase('nl').includes(q) || (!!handle && !!f.username && f.username.toLocaleLowerCase('nl').includes(handle))) : sorted;
}

export function toggleTarget(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
}

/** Bottom bar text: "Mijn verhaal, Aria, Milan +2" (empty string when nothing chosen). */
export function sendSummary(selected: string[], friends: SendFriend[], max = 3): string {
  const names = selected.map(id => id === STORY_TARGET ? 'Mijn verhaal' : friends.find(f => f.id === id)?.display_name).filter((x): x is string => !!x);
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}

/** Gedeeld verhaal targets are `shared:<id>` (lib/shared-stories.ts). */
export function splitTargets(selected: string[]): { story: boolean; friendIds: string[]; sharedIds: string[] } {
  return { story: selected.includes(STORY_TARGET), friendIds: selected.filter(x => x !== STORY_TARGET && !x.startsWith('shared:')), sharedIds: selected.filter(x => x.startsWith('shared:')).map(x => x.slice(7)) };
}

/** Snapchat's send sheet order: Beste vrienden (Vriend-emoji ranking, strongest first), Recent (newest 1-on-1 chat
 *  activity, max 6, not already a best friend), then every friend A–Z. A search shows only the matches (name or @username). */
export type SendActivity = { peerId: string; relation?: string | null; lastAt?: string | null };
const BEST_ORDER = ['super_bff', 'bffs', 'bff', 'mutual_best', 'best_friend', 'same_bff', 'their_best'];
export const RECENT_MAX = 6;
export function sendSections<T extends SendFriend>(friends: T[], activity: SendActivity[], query: string): { best: T[]; recent: T[]; all: T[]; search: boolean } {
  const all = filterFriends(friends, query);
  if (query.trim()) return { best: [], recent: [], all, search: true };
  const byId = new Map(friends.map(f => [f.id, f]));
  const act = activity.filter(a => byId.has(a.peerId));
  const rank = (r?: string | null) => { const i = BEST_ORDER.indexOf(r ?? ''); return i < 0 ? 99 : i; };
  const best = act.filter(a => rank(a.relation) < 99).sort((a, b) => rank(a.relation) - rank(b.relation) || (b.lastAt ?? '').localeCompare(a.lastAt ?? '')).map(a => byId.get(a.peerId)!);
  const bestIds = new Set(best.map(f => f.id));
  const recent = act.filter(a => a.lastAt && !bestIds.has(a.peerId)).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '')).slice(0, RECENT_MAX).map(a => byId.get(a.peerId)!);
  return { best: [...new Map(best.map(f => [f.id, f])).values()], recent: [...new Map(recent.map(f => [f.id, f])).values()], all, search: false };
}
