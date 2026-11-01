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

/** Verhalen › Verkennen grid: 2 columns on phones (as before), on desktop web as many ~240px cards as fit next to the
 *  side rail (max 6). Card widths are floored so a row never wraps. */
export const STORY_GRID = { pad: 13, gap: 9, minCard: 240, maxColumns: 6 } as const;
export function storyGrid(windowWidth: number, platform: string): { columns: number; cardWidth: number } {
  const w = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 390;
  const content = isSplitLayout(w, platform) ? w - SIDE_RAIL_WIDTH : w;
  const inner = content - STORY_GRID.pad * 2;
  const columns = isSplitLayout(w, platform)
    ? Math.max(2, Math.min(STORY_GRID.maxColumns, Math.floor((inner + STORY_GRID.gap) / (STORY_GRID.minCard + STORY_GRID.gap))))
    : 2;
  const cardWidth = Math.max(120, Math.floor((inner - STORY_GRID.gap * (columns - 1)) / columns));
  return { columns, cardWidth };
}

/** Settings-style pages (Instellingen, Meldingen, Help, …) on desktop web: a centred readable column like Snapchat Web
 *  instead of rows stretched over a 1440px screen. Phones and native: full width (null). */
export const READABLE_MAX_WIDTH = 760;
export function readableMaxWidth(windowWidth: number, platform: string): number | null {
  return isSplitLayout(windowWidth, platform) ? READABLE_MAX_WIDTH : null;
}

/** Herinneringen grid: 3 tall cells per row on phones (unchanged); on desktop web as many ~190px portrait cells as fit
 *  (max 8) so a 1440px screen doesn't show three 470×170 letterboxes. Returns a percentage width + pixel height. */
export const MEMORY_GRID = { phoneHeight: 170, minCell: 190, maxColumns: 8, ratio: 1.4 } as const;
export function memoryGrid(windowWidth: number, platform: string): { columns: number; width: `${number}%`; height: number } {
  const w = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 390;
  if (!isSplitLayout(w, platform)) return { columns: 3, width: '32.8%', height: MEMORY_GRID.phoneHeight };
  const columns = Math.max(4, Math.min(MEMORY_GRID.maxColumns, Math.floor(w / MEMORY_GRID.minCell)));
  const pct = Math.floor((100 / columns - 0.2) * 10) / 10;
  return { columns, width: `${pct}%`, height: Math.round((w / columns) * MEMORY_GRID.ratio) };
}
