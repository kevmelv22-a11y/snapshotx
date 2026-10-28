/** Snapchat+ "Chat-achtergrond" (Chat Wallpaper): one wallpaper per chat that EVERY member sees (friends without X+ too);
 *  only Snapshot X+ members can set, change or clear it, and a grey system line tells the chat who changed it.
 *  Source of truth: sx_threads.wallpaper via sx_set_wallpaper (migration 20261028150000_chat_wallpaper.sql, NOT applied). */
import { WALLPAPERS, type WallpaperId } from './plus';

export const WALLPAPER_COPY = {
  title: 'Chat-achtergrond',
  hint: 'Iedereen in deze chat ziet de achtergrond, ook zonder Snapshot X+.',
  locked: 'Alleen Snapshot X+-leden kunnen de achtergrond kiezen of wijzigen.',
  clear: 'Achtergrond verwijderen',
} as const;

export const WALLPAPER_ERRORS = {
  notMember: 'Je zit niet (meer) in deze chat.',
  invalid: 'Deze achtergrond bestaat niet.',
  needsPlus: 'Alleen Snapshot X+-leden kunnen de achtergrond wijzigen.',
} as const;

export const WALLPAPER_IDS: readonly WallpaperId[] = WALLPAPERS.map(w => w.id);

/** Unknown / null / old values → 'none' (the normal chat background). */
export function parseWallpaper(v: unknown): WallpaperId {
  return typeof v === 'string' && (WALLPAPER_IDS as readonly string[]).includes(v) ? (v as WallpaperId) : 'none';
}

export function wallpaperLabel(id: string): string {
  return WALLPAPERS.find(w => w.id === id)?.label ?? 'Geen';
}

export function wallpaperColors(id: string): [string, string] {
  return (WALLPAPERS.find(w => w.id === parseWallpaper(id)) ?? WALLPAPERS[0]).colors;
}

/** Grey system line, like Snapchat's "You changed the wallpaper". */
export function wallpaperChangeText(name: string, id: WallpaperId): string {
  const who = name.trim() || 'Iemand';
  return id === 'none' ? `${who} heeft de chat-achtergrond verwijderd` : `${who} heeft de chat-achtergrond gewijzigd in ${wallpaperLabel(id)}`;
}

export function isWallpaperChangeText(body: string | null | undefined): boolean {
  return !!body && / heeft de chat-achtergrond (verwijderd|gewijzigd in )/.test(body);
}

/** Client-side check before calling the RPC (the server checks membership + X+ again). Picking the current one is a no-op. */
export function wallpaperChange(current: WallpaperId, next: string, plus: boolean): { ok: true; id: WallpaperId } | { ok: false; error: string | null } {
  if (!(WALLPAPER_IDS as readonly string[]).includes(next)) return { ok: false, error: WALLPAPER_ERRORS.invalid };
  if (!plus) return { ok: false, error: WALLPAPER_ERRORS.needsPlus };
  if (next === current) return { ok: false, error: null };
  return { ok: true, id: next as WallpaperId };
}

/** Maps server errors from sx_set_wallpaper to the Dutch copy (null = not a wallpaper error). */
export function wallpaperErrorText(e: unknown): string | null {
  const m = String((e as { message?: string } | null)?.message ?? e ?? '');
  for (const t of Object.values(WALLPAPER_ERRORS)) if (m.includes(t)) return t;
  if (/not a member/i.test(m)) return WALLPAPER_ERRORS.notMember;
  if (/invalid wallpaper/i.test(m)) return WALLPAPER_ERRORS.invalid;
  if (/requires plus|snapshot x\+/i.test(m)) return WALLPAPER_ERRORS.needsPlus;
  return null;
}
