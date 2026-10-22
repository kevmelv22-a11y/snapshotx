/** Snapchat chat-feed settings (long-press a conversation): pin up to 3 chats on top and
 *  "Wissen uit chatfeed" (hide a chat until a new message arrives). Pure helpers; the
 *  per-account state lives in stores/chatFeed.ts (device-local, like Snapchat's feed order). */

export const MAX_PINS = 3;
export const PIN_LIMIT_MESSAGE = `Je kunt maximaal ${MAX_PINS} gesprekken vastzetten. Maak er eerst een los.`;

export type FeedPrefs = {
  /** Pinned thread ids, oldest pin first (the first pin stays on top, as in Snapchat). */
  pins: string[];
  /** threadId -> ISO time it was cleared from the feed. */
  cleared: Record<string, string>;
};
export const EMPTY_FEED: FeedPrefs = { pins: [], cleared: {} };

type Row = { id: string; createdAt: string | null };

export function isPinned(prefs: FeedPrefs | undefined, id: string): boolean {
  return !!prefs?.pins.includes(id);
}

/** Pin/unpin. Pinning a 4th chat is refused (prefs unchanged + message). Pinning also un-clears the chat. */
export function togglePin(prefs: FeedPrefs, id: string): { prefs: FeedPrefs; error: string | null } {
  if (prefs.pins.includes(id)) return { prefs: { ...prefs, pins: prefs.pins.filter(x => x !== id) }, error: null };
  if (prefs.pins.length >= MAX_PINS) return { prefs, error: PIN_LIMIT_MESSAGE };
  const cleared = { ...prefs.cleared }; delete cleared[id];
  return { prefs: { pins: [...prefs.pins, id], cleared }, error: null };
}

/** "Wissen uit chatfeed": hides the row until a message newer than `now` arrives. Also unpins it. */
export function clearFromFeed(prefs: FeedPrefs, id: string, now: Date | string = new Date()): FeedPrefs {
  const at = typeof now === 'string' ? now : now.toISOString();
  return { pins: prefs.pins.filter(x => x !== id), cleared: { ...prefs.cleared, [id]: at } };
}

/** A cleared chat comes back as soon as it has a message newer than the moment it was cleared. */
export function isCleared(prefs: FeedPrefs | undefined, row: Row): boolean {
  const at = prefs?.cleared[row.id];
  if (!at) return false;
  return !row.createdAt || row.createdAt <= at;
}

/** Feed order: pinned chats first (in pin order), then the rest in their existing (newest-first) order.
 *  Cleared chats are dropped. Stale pins (chat no longer in the list) are ignored. Does not mutate. */
export function arrangeFeed<T extends Row>(rows: readonly T[], prefs: FeedPrefs | undefined): T[] {
  const visible = rows.filter(r => !isCleared(prefs, r));
  const pins = prefs?.pins ?? [];
  const pinned = pins.map(id => visible.find(r => r.id === id)).filter((r): r is T => !!r);
  return [...pinned, ...visible.filter(r => !pins.includes(r.id))];
}

/** Drops cleared marks that have been superseded by a newer message (keeps storage small). */
export function pruneCleared(prefs: FeedPrefs, rows: readonly Row[]): FeedPrefs {
  const cleared: Record<string, string> = {};
  let changed = false;
  for (const [id, at] of Object.entries(prefs.cleared)) {
    const row = rows.find(r => r.id === id);
    if (row && row.createdAt && row.createdAt > at) { changed = true; continue; }
    cleared[id] = at;
  }
  return changed ? { ...prefs, cleared } : prefs;
}
