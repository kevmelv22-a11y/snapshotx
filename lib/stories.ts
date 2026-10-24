/** Pure story logic (step 5): 24h expiry, grouping per owner, ring state, viewer navigation, progress, viewers list. */
export const STORY_TTL_MS = 24 * 3600_000;
export const PHOTO_DURATION_MS = 5000;
export const MAX_VIEWERS = 200;

export type StoryLike = { id: string; owner_id: string; created_at: string; expires_at: string; media_type: 'photo' | 'video' };
export type StoryGroup<T extends StoryLike> = { ownerId: string; stories: T[]; allSeen: boolean; latestAt: number };
export type RingState = 'none' | 'unseen' | 'seen';

export function isActive(s: { expires_at: string }, now: number): boolean { return Date.parse(s.expires_at) > now; }
export function expiresAtFor(createdAt: number): string { return new Date(createdAt + STORY_TTL_MS).toISOString(); }

/** Dutch "nog X u" / "nog X min" label, or 'verlopen'. */
export function timeLeftLabel(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return 'verlopen';
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? `nog ${h} u` : `nog ${Math.max(1, Math.floor(ms / 60000))} min`;
}
export function ageLabel(createdAt: string, now: number): string {
  const m = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60000));
  if (m < 1) return 'zojuist';
  if (m < 60) return `${m} min geleden`;
  return `${Math.floor(m / 60)} u geleden`;
}

/** Groups active stories by owner (oldest first inside a group). Own group first, then unseen groups, then seen; newest activity first. */
export function groupStories<T extends StoryLike>(stories: T[], seen: Set<string>, now: number, meId?: string): StoryGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const s of stories) { if (!isActive(s, now)) continue; const l = map.get(s.owner_id) ?? []; l.push(s); map.set(s.owner_id, l); }
  const groups = [...map.entries()].map(([ownerId, list]) => {
    list.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return { ownerId, stories: list, allSeen: list.every(s => seen.has(s.id)), latestAt: Date.parse(list[list.length - 1].created_at) };
  });
  const rank = (g: StoryGroup<T>) => (g.ownerId === meId ? 0 : g.allSeen ? 2 : 1);
  return groups.sort((a, b) => rank(a) - rank(b) || b.latestAt - a.latestAt);
}

export function ringState(group: { stories: unknown[]; allSeen: boolean } | undefined): RingState {
  if (!group || group.stories.length === 0) return 'none';
  return group.allSeen ? 'seen' : 'unseen';
}

/** Index of the first unseen story in a group (resume where you left off), else 0. */
export function startIndex(stories: { id: string }[], seen: Set<string>): number {
  const i = stories.findIndex(s => !seen.has(s.id));
  return i < 0 ? 0 : i;
}

export type Cursor = { group: number; story: number };
export type NavResult = { cursor: Cursor } | { close: true };
/** Tap right / auto-advance: next story, then next group, then close. */
export function next(c: Cursor, sizes: number[]): NavResult {
  if (c.story + 1 < sizes[c.group]) return { cursor: { group: c.group, story: c.story + 1 } };
  if (c.group + 1 < sizes.length) return { cursor: { group: c.group + 1, story: 0 } };
  return { close: true };
}
/** Tap left: previous story, then last story of previous group, else restart the first. */
export function prev(c: Cursor, sizes: number[]): NavResult {
  if (c.story > 0) return { cursor: { group: c.group, story: c.story - 1 } };
  if (c.group > 0) return { cursor: { group: c.group - 1, story: sizes[c.group - 1] - 1 } };
  return { cursor: { group: 0, story: 0 } };
}
/** Tap zone: left third goes back, the rest forward. */
export function tapAction(x: number, width: number): 'prev' | 'next' { return x < width / 3 ? 'prev' : 'next'; }

export type Swipe = 'nextGroup' | 'prevGroup' | 'close' | 'reply' | null;
/** Horizontal swipe switches friend, swipe down closes, swipe up opens reply. Threshold in px. */
export function classifySwipe(dx: number, dy: number, threshold = 60): Swipe {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'nextGroup' : 'prevGroup';
  return dy > 0 ? 'close' : 'reply';
}
export function switchGroup(c: Cursor, sizes: number[], dir: 1 | -1): NavResult {
  const g = c.group + dir;
  if (g < 0) return { cursor: { group: 0, story: 0 } };
  if (g >= sizes.length) return { close: true };
  return { cursor: { group: g, story: 0 } };
}

/** Pausable progress clock. elapsed accumulates only while not paused. */
export type Clock = { elapsed: number; runningSince: number | null };
export const startClock = (now: number): Clock => ({ elapsed: 0, runningSince: now });
export const pauseClock = (c: Clock, now: number): Clock => c.runningSince == null ? c : { elapsed: c.elapsed + now - c.runningSince, runningSince: null };
export const resumeClock = (c: Clock, now: number): Clock => c.runningSince != null ? c : { ...c, runningSince: now };
export const elapsedOf = (c: Clock, now: number) => c.elapsed + (c.runningSince == null ? 0 : now - c.runningSince);
export function progress(c: Clock, now: number, duration = PHOTO_DURATION_MS): number { return Math.min(1, Math.max(0, elapsedOf(c, now) / duration)); }
/** Fill fraction for each segment bar of the current group. */
export function segmentFills(count: number, current: number, p: number): number[] {
  return Array.from({ length: count }, (_, i) => (i < current ? 1 : i === current ? p : 0));
}

export type ViewRow = { story_id: string; viewer_id: string; viewed_at: string };
export type ReactionRow = { story_id: string; user_id: string; emoji: string };
export type Viewer = { userId: string; viewedAt: string; emoji: string | null };
/** Viewers of one story, owner excluded, newest first, capped at 200 names; total is the full count. */
export function viewersFor(storyId: string, views: ViewRow[], reactions: ReactionRow[], ownerId: string): { viewers: Viewer[]; total: number } {
  const byUser = new Map<string, Viewer>();
  for (const v of views) {
    if (v.story_id !== storyId || v.viewer_id === ownerId) continue;
    const prevV = byUser.get(v.viewer_id);
    if (!prevV || Date.parse(v.viewed_at) > Date.parse(prevV.viewedAt)) byUser.set(v.viewer_id, { userId: v.viewer_id, viewedAt: v.viewed_at, emoji: null });
  }
  for (const r of reactions) { const v = byUser.get(r.user_id); if (r.story_id === storyId && v) v.emoji = r.emoji; }
  const all = [...byUser.values()].sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt));
  return { viewers: all.slice(0, MAX_VIEWERS), total: all.length };
}
export function viewersLabel(total: number): string { return total === 1 ? '1 kijker' : `${total} kijkers`; }

/** Chat body for a reply to a story; trimmed, max 500 chars, null if empty. */
export function storyReplyBody(text: string, caption: string | null): string | null {
  const t = text.trim();
  if (!t) return null;
  const ref = caption?.trim() ? ` „${caption.trim().slice(0, 40)}”` : '';
  return `Antwoord op je verhaal${ref}: ${t}`.slice(0, 500);
}
