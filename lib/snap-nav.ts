/**
 * Snapchat-style navigation: five tabs in one row (Kaart · Chat · Camera · Verhalen · Spotlight) and horizontal
 * swipes move one tab left/right, like Snapchat's pager. Swipe up on the camera opens Herinneringen.
 */
export const SNAP_TABS = ['map', 'chats', 'index', 'stories', 'videos'] as const;
export type SnapTab = typeof SNAP_TABS[number];
export const TAB_LABEL: Record<SnapTab, string> = { map: 'Kaart', chats: 'Chat', index: 'Camera', stories: 'Verhalen', videos: 'Spotlight' };
export const TAB_HREF: Record<SnapTab, string> = { map: '/(tabs)/map', chats: '/(tabs)/chats', index: '/', stories: '/(tabs)/stories', videos: '/(tabs)/videos' };

export type SwipeAction = { kind: 'tab'; tab: SnapTab } | { kind: 'memories' } | null;

/** Is this movement a deliberate horizontal swipe (not a vertical scroll / tap)? */
export function isHorizontalSwipe(dx: number, dy: number, min = 18): boolean {
  return Math.abs(dx) > min && Math.abs(dx) > Math.abs(dy) * 1.6;
}

/**
 * Resolve a released swipe. Finger moving left (dx < 0) reveals the screen on the right (Snapchat: camera → Verhalen),
 * finger moving right reveals the screen on the left (camera → Chat). Fast flicks count with a shorter distance.
 */
export function swipeTarget(from: SnapTab, dx: number, dy: number, vx = 0, opts: { up?: boolean } = {}): SwipeAction {
  const fast = Math.abs(vx) > 0.6;
  const min = fast ? 40 : 80;
  if (opts.up && dy < -100 && Math.abs(dy) > Math.abs(dx) * 1.6) return { kind: 'memories' };
  if (!(Math.abs(dx) >= min && Math.abs(dx) > Math.abs(dy) * 1.6)) return null;
  const i = SNAP_TABS.indexOf(from) + (dx < 0 ? 1 : -1);
  if (i < 0 || i >= SNAP_TABS.length) return null;
  return { kind: 'tab', tab: SNAP_TABS[i] };
}

/** Taps closer together than this (ms) on the camera flip the lens, like Snapchat's double tap. */
export const DOUBLE_TAP_MS = 300;
export function isDoubleTap(prev: number | null, now: number, ms = DOUBLE_TAP_MS): boolean {
  return prev != null && now - prev > 0 && now - prev <= ms;
}
