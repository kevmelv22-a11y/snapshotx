/** Pure logic for Spotlight ("Uitgelicht") social features, Snapchat-style: comments (Reacties) with likes,
 * subscribing to a creator (Abonneren) and double-tap to like. No React, no backend. */
export type SpotComment = { id: string; story_id: string; user_id: string; body: string; created_at: string };
export type SpotCommentLike = { comment_id: string; user_id: string };
export type CommentView = SpotComment & { likes: number; liked: boolean; mine: boolean; pinned: boolean };

export const COMMENT_MAX = 150;
export const COMMENT_PLACEHOLDER = 'Voeg een reactie toe…';
export const DOUBLE_TAP_MS = 300;
/** A comment I posted in the last 10 minutes stays on top (Snapchat shows your new comment first). */
export const FRESH_MS = 10 * 60_000;

/** Trimmed, whitespace-collapsed comment text, or null when empty. Longer texts are cut to COMMENT_MAX characters. */
export function normalizeComment(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return Array.from(t).slice(0, COMMENT_MAX).join('');
}
/** Characters left (counts emoji as one). */
export function charsLeft(text: string): number { return COMMENT_MAX - Array.from(text).length; }

/** "1 reactie", "12 reacties", "Nog geen reacties". */
export function commentsTitle(n: number): string { return n === 0 ? 'Nog geen reacties' : n === 1 ? '1 reactie' : `${n} reacties`; }

/** Compact comment age: "Nu", "5 min", "2 u", "3 d", "2 w". */
export function commentAge(createdAt: string, now: number): string {
  const min = Math.floor(Math.max(0, now - Date.parse(createdAt)) / 60000);
  if (min < 1) return 'Nu';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} u`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} d` : `${Math.floor(d / 7)} w`;
}

/** Comments of one snap: blocked authors hidden; my fresh comments pinned on top, then most liked, then newest. */
export function commentThread(comments: SpotComment[], likes: SpotCommentLike[], storyId: string, me: string, now: number, blocked: Set<string> = new Set()): CommentView[] {
  return comments.filter(c => c.story_id === storyId && !blocked.has(c.user_id)).map(c => {
    const l = likes.filter(x => x.comment_id === c.id);
    const mine = c.user_id === me;
    return { ...c, likes: l.length, liked: l.some(x => x.user_id === me), mine, pinned: mine && now - Date.parse(c.created_at) < FRESH_MS };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.pinned ? b.created_at.localeCompare(a.created_at) : 0) || b.likes - a.likes || b.created_at.localeCompare(a.created_at));
}
export function commentCount(comments: SpotComment[], storyId: string, blocked: Set<string> = new Set()): number {
  return comments.filter(c => c.story_id === storyId && !blocked.has(c.user_id)).length;
}
/** Toggle my like on a comment (returns a new list). */
export function toggleCommentLike(likes: SpotCommentLike[], commentId: string, me: string): SpotCommentLike[] {
  return likes.some(l => l.comment_id === commentId && l.user_id === me)
    ? likes.filter(l => !(l.comment_id === commentId && l.user_id === me))
    : [...likes, { comment_id: commentId, user_id: me }];
}
/** Only the author or the snap's owner may delete a comment. */
export function canDeleteComment(c: SpotComment, me: string, storyOwner: string): boolean { return c.user_id === me || storyOwner === me; }

/** Subscribe button: never on your own snaps. */
export function subscribeLabel(subscribed: boolean): string { return subscribed ? 'Geabonneerd' : 'Abonneren'; }
export function canSubscribe(creator: string, me: string): boolean { return !!creator && creator !== me; }
export function toggleSubscription(subs: Set<string>, creator: string): Set<string> {
  const n = new Set(subs);
  if (n.has(creator)) n.delete(creator); else n.add(creator);
  return n;
}
/** "1 abonnee", "1,2K abonnees" using the given count formatter. */
export function subscriberText(n: number, fmt: (n: number) => string = String): string { return `${fmt(n)} ${n === 1 ? 'abonnee' : 'abonnees'}`; }

/** Double tap = second tap within DOUBLE_TAP_MS. Double tap only ever likes (never unlikes), like Snapchat. */
export function isDoubleTap(lastTapAt: number | null, now: number, windowMs = DOUBLE_TAP_MS): boolean {
  return lastTapAt != null && now - lastTapAt >= 0 && now - lastTapAt <= windowMs;
}
export function likeOnDoubleTap(state: { liked: boolean; likes: number }): { liked: boolean; likes: number; changed: boolean } {
  return state.liked ? { ...state, changed: false } : { liked: true, likes: state.likes + 1, changed: true };
}
/** Subscriber count after my (optimistic) toggle: base was counted with my state at load time. */
export function liveSubscribers(base: number, subscribedAtLoad: boolean, subscribedNow: boolean): number {
  return Math.max(0, base + (subscribedNow === subscribedAtLoad ? 0 : subscribedNow ? 1 : -1));
}
