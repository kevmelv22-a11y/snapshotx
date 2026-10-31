/** Snapchat Web-style desktop layout: split view (chat list left, open chat right) on wide web screens. */
export const SPLIT_MIN_WIDTH = 1024;
export const SPLIT_LIST_WIDTH = 360;

/** Split view only on web and only when the window is at least SPLIT_MIN_WIDTH wide; native keeps mobile tabs. */
export function isSplitLayout(width: number, platform: string): boolean {
  return platform === 'web' && Number.isFinite(width) && width >= SPLIT_MIN_WIDTH;
}

/** Pick the thread to show on the right: keep the current one if still listed, else the first real (non-demo) row. */
export function pickOpenThread(current: string | null, rows: readonly { id: string; demo?: boolean }[], isRealId: (id: string) => boolean): string | null {
  if (current && rows.some(r => r.id === current)) return current;
  return rows.find(r => !r.demo && isRealId(r.id))?.id ?? null;
}
