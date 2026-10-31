/**
 * Snapchat Web keyboard shortcuts (desktop split view):
 *  - Ctrl/⌘+K: search chats            - Alt+↑ / Alt+↓: previous / next chat
 *  - Esc: close the search (chat list) or cancel a reply/edit (open chat)
 * Typing in a text field never triggers Alt+arrows/Esc handled elsewhere except the explicit cases below.
 */
export type KeyLike = { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown; shiftKey?: unknown; isComposing?: unknown; keyCode?: unknown };
export type Shortcut = 'search' | 'prev' | 'next' | 'escape';

export const SHORTCUT_HINTS: readonly (readonly [string, string])[] = [
  ['Ctrl/⌘ K', 'Chats zoeken'],
  ['Alt ↑ / ↓', 'Vorige / volgende chat'],
  ['Enter', 'Versturen (Shift+Enter: nieuwe regel)'],
  ['Ctrl/⌘ V of slepen', 'Foto of video versturen'],
  ['Esc', 'Zoeken sluiten / antwoord annuleren'],
];

export function shortcutOf(e: KeyLike | null | undefined): Shortcut | null {
  if (!e || e.isComposing === true || e.keyCode === 229) return null;
  const k = typeof e.key === 'string' ? e.key : '';
  const mod = e.ctrlKey === true || e.metaKey === true;
  if (mod && e.altKey !== true && e.shiftKey !== true && k.toLowerCase() === 'k') return 'search';
  if (e.altKey === true && !mod && k === 'ArrowUp') return 'prev';
  if (e.altKey === true && !mod && k === 'ArrowDown') return 'next';
  if (k === 'Escape' && !mod && e.altKey !== true) return 'escape';
  return null;
}

/** Thread to open for Alt+↑/↓: wraps around; skips demo/example rows; null when there is nothing to move to. */
export function stepThread(rows: readonly { id: string; demo?: boolean }[], current: string | null, dir: 1 | -1, isRealId: (id: string) => boolean): string | null {
  const ids = rows.filter(r => !r.demo && isRealId(r.id)).map(r => r.id);
  if (!ids.length) return null;
  const i = current ? ids.indexOf(current) : -1;
  if (i < 0) return dir === 1 ? ids[0] : ids[ids.length - 1];
  const next = ids[(i + dir + ids.length) % ids.length];
  return next === current ? null : next;
}
