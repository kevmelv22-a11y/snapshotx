/** Gedeeld verhaal (Snapchat shared stories): pure helpers. Server rules live in
 *  supabase/migrations/20261120060000_shared_stories.sql (members only, friends of the adder, max 30). */
export const SHARED_TITLE_MAX = 40;
export const SHARED_MAX_MEMBERS = 30;
export const SHARED_TARGET_PREFIX = 'shared:';
export type SharedStory = { id: string; title: string; created_by: string | null; created_at: string };
export type SharedMember = { shared_story_id: string; user_id: string };
type StoryRow = { id: string; owner_id: string; created_at: string; shared_story_id?: string | null };

export function cleanSharedTitle(title: string): string | null {
  const t = title.replace(/\s+/g, ' ').trim();
  return t && t.length <= SHARED_TITLE_MAX ? t : null;
}
/** Suggested name from the first friends ("Aria, Eva & ik"). */
export function suggestTitle(names: string[]): string {
  const first = names.filter(Boolean).slice(0, 2);
  return (first.length ? `${first.join(', ')} & ik` : 'Ons verhaal').slice(0, SHARED_TITLE_MAX);
}
export const sharedTarget = (id: string) => `${SHARED_TARGET_PREFIX}${id}`;
export const isSharedTarget = (t: string) => t.startsWith(SHARED_TARGET_PREFIX);
export const sharedIdOf = (t: string) => (isSharedTarget(t) ? t.slice(SHARED_TARGET_PREFIX.length) : null);

/** Personal feed rows (normal stories) vs. rows per shared story. */
export function splitStoryFeed<T extends StoryRow>(rows: readonly T[]): { personal: T[]; shared: Map<string, T[]> } {
  const personal: T[] = [], shared = new Map<string, T[]>();
  for (const r of rows) {
    if (r.shared_story_id) { const l = shared.get(r.shared_story_id) ?? []; l.push(r); shared.set(r.shared_story_id, l); }
    else personal.push(r);
  }
  return { personal, shared };
}
export type SharedBubble = { id: string; title: string; count: number; members: number; ring: 'none' | 'unseen' | 'seen'; latestAt: number };
/** Bubbles for the Verhalen tab: groups with new snaps first, then the newest; empty groups last (you can still add). */
export function sharedBubbles(groups: readonly SharedStory[], members: readonly SharedMember[], rows: readonly StoryRow[], seen: ReadonlySet<string>): SharedBubble[] {
  const { shared } = splitStoryFeed(rows);
  return groups.map(g => {
    const list = shared.get(g.id) ?? [];
    const ring: SharedBubble['ring'] = !list.length ? 'none' : list.some(r => !seen.has(r.id)) ? 'unseen' : 'seen';
    return { id: g.id, title: g.title, count: list.length, members: members.filter(m => m.shared_story_id === g.id).length, ring, latestAt: Math.max(0, ...list.map(r => Date.parse(r.created_at))) };
  }).sort((a, b) => (a.ring === 'unseen' ? 0 : a.ring === 'seen' ? 1 : 2) - (b.ring === 'unseen' ? 0 : b.ring === 'seen' ? 1 : 2) || b.latestAt - a.latestAt || a.title.localeCompare(b.title, 'nl'));
}
/** Friends you can still add (not already a member), max members respected. */
export function addableFriends<T extends { id: string }>(friends: readonly T[], memberIds: readonly string[]): T[] {
  const have = new Set(memberIds);
  return friends.filter(f => !have.has(f.id));
}
export function membersLabel(n: number): string { return n === 1 ? '1 lid' : `${n} leden`; }
/** Dutch messages for the server errors of the RPCs. */
export function sharedErrorText(message: string): string {
  if (/Only friends/i.test(message)) return 'Je kunt alleen je eigen vrienden toevoegen.';
  if (/max 30/i.test(message)) return `Een gedeeld verhaal heeft maximaal ${SHARED_MAX_MEMBERS} leden.`;
  if (/Invalid shared story name/i.test(message)) return `Geef je gedeelde verhaal een naam (max ${SHARED_TITLE_MAX} tekens).`;
  if (/at least one friend/i.test(message)) return 'Kies minstens één vriend.';
  if (/Not a member/i.test(message)) return 'Je zit niet (meer) in dit gedeelde verhaal.';
  return 'Dat lukte niet. Probeer het opnieuw.';
}
/** One viewer group for a Gedeeld verhaal: all members' snaps in time order, keyed `shared:<id>` so the viewer header
 *  can show the shared story's title (replies/reactions still go to the snap's own owner). */
export function sharedViewerGroup<T extends StoryRow & { expires_at: string }>(rows: readonly T[], id: string, seen: ReadonlySet<string>, now: number) {
  const stories = rows.filter(r => r.shared_story_id === id && Date.parse(r.expires_at) > now).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (!stories.length) return null;
  return { ownerId: sharedTarget(id), stories, allSeen: stories.every(s => seen.has(s.id)), latestAt: Date.parse(stories[stories.length - 1].created_at) };
}
/** Rows for the personal story feeds (Verhalen, Mijn verhaal, friend profile rings): never Gedeeld verhaal snaps. */
export const personalOnly = <T extends { shared_story_id?: string | null }>(rows: readonly T[]): T[] => rows.filter(r => !r.shared_story_id);
