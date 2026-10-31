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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `?chat=<thread uuid>` in the web URL keeps the open chat after a refresh / shared desktop link; anything else is ignored. */
export function splitChatParam(v: string | string[] | undefined | null): string | null {
  const s = (Array.isArray(v) ? v[0] : v) ?? '';
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}

/** Width of the narrow desktop side rail that replaces the left tab bar. */
export const SIDE_RAIL_WIDTH = 88;

/** Rail entries in the given order, only for routes that exist in the navigator (hidden routes are never listed). */
export function railItems<T extends { name: string }>(items: readonly T[], routeNames: readonly string[]): T[] {
  const set = new Set(routeNames);
  return items.filter(i => set.has(i.name));
}

/** Footer on the web login/landing page (exact text requested by Kevin). */
export const WEB_FOOTER = '• © Vonk Byte • Snapshot-X 2026-2027 •';

/** Hosts of the live public web version: never show demo shortcuts there. */
export const PUBLIC_WEB_HOSTS = ['snapshot-x.nl', 'www.snapshot-x.nl', 'snapshot-x.expo.app'];

/**
 * "Start demo als Kevin" shortcut on the login screen: only in a demo build that explicitly opts in with
 * EXPO_PUBLIC_DEMO_BUTTON=1 (local testing), and never on a public host. Kevin wants no demo button live.
 */
export function showDemoLoginButton(demoMode: boolean, flag: string | undefined, hostname: string | undefined): boolean {
  if (!demoMode || flag !== '1') return false;
  const host = (hostname ?? '').toLowerCase();
  return !PUBLIC_WEB_HOSTS.includes(host);
}
