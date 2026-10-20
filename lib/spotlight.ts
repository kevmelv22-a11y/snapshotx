/** Pure logic for the public vertical feed ("Uitgelicht", step 5). No trademarked names in UI. */
export type FeedItem = { id: string; owner_id: string; created_at: string; likes: number; shares: number; views: number };

/** Dutch compact counter: 999, 1,2K, 12K, 1,5 mln. */
export function formatCount(n: number): string {
  if (n < 1000) return String(Math.max(0, Math.floor(n)));
  const fmt = (v: number) => (v < 10 ? (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',') : String(Math.floor(v)));
  if (n < 1_000_000) return `${fmt(n / 1000)}K`;
  return `${fmt(n / 1_000_000)} mln`;
}

/** Score: engagement with a time decay (half-life 12 h). Blocked owners removed. */
export function score(i: FeedItem, now: number): number {
  const ageH = Math.max(0, (now - Date.parse(i.created_at)) / 3600_000);
  return (1 + i.likes * 3 + i.shares * 5 + i.views * 0.1) * Math.pow(0.5, ageH / 12);
}
export function rankFeed<T extends FeedItem>(items: T[], now: number, blocked: Set<string> = new Set()): T[] {
  return items.filter(i => !blocked.has(i.owner_id)).sort((a, b) => score(b, now) - score(a, now) || b.created_at.localeCompare(a.created_at));
}

/** Optimistic like toggle. */
export function toggleLike(state: { liked: boolean; likes: number }): { liked: boolean; likes: number } {
  return state.liked ? { liked: false, likes: Math.max(0, state.likes - 1) } : { liked: true, likes: state.likes + 1 };
}

/** Index after a vertical swipe (dy<0 = swipe up = next). Clamped. */
export function swipeIndex(index: number, dy: number, count: number, threshold = 80): number {
  if (count === 0) return 0;
  if (dy <= -threshold) return Math.min(count - 1, index + 1);
  if (dy >= threshold) return Math.max(0, index - 1);
  return index;
}
/** Snap a scroll offset to a page index. */
export function pageFromOffset(offsetY: number, pageHeight: number, count: number): number {
  if (pageHeight <= 0 || count === 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetY / pageHeight)));
}
export function shareText(name: string, caption: string | null): string {
  return `Bekijk deze snap van ${name} op SnapShot X${caption?.trim() ? `: ${caption.trim()}` : ''}`;
}
