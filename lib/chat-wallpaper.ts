/** Snapchat+ "Chat-achtergrond" (Chat Wallpaper): one wallpaper per chat that EVERY member sees (friends without X+ too);
 *  every member (with or without Snapshot X+) can set, change or clear it, and a grey system line tells the chat who changed it.
 *  Source of truth: sx_threads.wallpaper via sx_set_wallpaper (migration 20261028150000_chat_wallpaper.sql, NOT applied). */
import { WALLPAPERS, type WallpaperId } from './plus';

export const WALLPAPER_COPY = {
  title: 'Chat-achtergrond',
  hint: 'Iedereen in deze chat ziet de achtergrond, ook zonder Snapshot X+.',
  clear: 'Achtergrond verwijderen',
} as const;

export const WALLPAPER_ERRORS = {
  notMember: 'Je zit niet (meer) in deze chat.',
  invalid: 'Deze achtergrond bestaat niet.',
  badPhoto: 'Deze foto kan niet als achtergrond worden gebruikt.',
} as const;

/** Snapchat+ also lets you use a photo from your Camera Roll as the chat wallpaper (optionally blurred for readability).
 *  Stored as sx_threads.wallpaper = 'photo' + wallpaper_path / wallpaper_blur (migration 20261028180000, NOT applied). */
export const PHOTO_WALLPAPER = 'photo' as const;
export type ChatWallpaperId = WallpaperId | typeof PHOTO_WALLPAPER;
export type PhotoWallpaper = { path: string; blur: boolean };
export const PHOTO_COPY = {
  label: 'Eigen foto',
  pick: 'Kies uit filmrol',
  change: 'Andere foto kiezen',
  blur: 'Vervagen',
  blurHint: 'Vervaag de foto zodat chats beter leesbaar blijven.',
} as const;
/** blurRadius for the RN <Image> (iOS/Android/web) when "Vervagen" is on. */
export const WALLPAPER_BLUR_RADIUS = 18;
// uploadMedia() paths: "<user uuid>/<random uuid>.jpg" in the snapshotx-media bucket.
const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;
export function isPhotoWallpaperPath(v: unknown): v is string { return typeof v === 'string' && PHOTO_PATH.test(v); }

/** Row from sx_threads (wallpaper, wallpaper_path, wallpaper_blur) → what to draw. A 'photo' without a valid path → normal background. */
export function parseChatWallpaper(row: { wallpaper?: unknown; wallpaper_path?: unknown; wallpaper_blur?: unknown } | null | undefined): { id: ChatWallpaperId; photo: PhotoWallpaper | null } {
  if (row?.wallpaper === PHOTO_WALLPAPER) return isPhotoWallpaperPath(row.wallpaper_path) ? { id: PHOTO_WALLPAPER, photo: { path: row.wallpaper_path, blur: row.wallpaper_blur === true } } : { id: 'none', photo: null };
  return { id: parseWallpaper(row?.wallpaper), photo: null };
}

/** Grey line when someone sets a (new) photo; only toggling blur adds no line. */
export function photoWallpaperText(name: string): string {
  return `${name.trim() || 'Iemand'} heeft een foto als chat-achtergrond ingesteld`;
}

/** Client check before sx_set_wallpaper_photo (server checks member, own folder + object exists again).
 *  line = system text to post (null when only the blur changed). Same photo + same blur = silent no-op. */
export function photoWallpaperChange(current: { id: ChatWallpaperId; photo: PhotoWallpaper | null }, next: PhotoWallpaper, me: string, name: string):
  { ok: true; photo: PhotoWallpaper; line: string | null } | { ok: false; error: string | null } {
  if (!isPhotoWallpaperPath(next.path) || !me || next.path.split('/')[0].toLowerCase() !== me.toLowerCase()) return { ok: false, error: WALLPAPER_ERRORS.badPhoto };
  const samePath = current.id === PHOTO_WALLPAPER && current.photo?.path === next.path;
  if (samePath && current.photo?.blur === next.blur) return { ok: false, error: null };
  return { ok: true, photo: { path: next.path, blur: next.blur }, line: samePath ? null : photoWallpaperText(name) };
}

export const WALLPAPER_IDS: readonly WallpaperId[] = WALLPAPERS.map(w => w.id);

/** Unknown / null / old values → 'none' (the normal chat background). */
export function parseWallpaper(v: unknown): WallpaperId {
  return typeof v === 'string' && (WALLPAPER_IDS as readonly string[]).includes(v) ? (v as WallpaperId) : 'none';
}

export function wallpaperLabel(id: string): string {
  if (id === PHOTO_WALLPAPER) return PHOTO_COPY.label;
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
  return !!body && / heeft (de chat-achtergrond (verwijderd|gewijzigd in )|een foto als chat-achtergrond ingesteld)/.test(body);
}

/** Client-side check before calling the RPC (the server checks membership again; open to everyone, no X+ needed). Picking the current one is a no-op. */
export function wallpaperChange(current: ChatWallpaperId, next: string): { ok: true; id: WallpaperId } | { ok: false; error: string | null } {
  if (!(WALLPAPER_IDS as readonly string[]).includes(next)) return { ok: false, error: WALLPAPER_ERRORS.invalid };
  if (next === current) return { ok: false, error: null };
  return { ok: true, id: next as WallpaperId };
}

/** Maps server errors from sx_set_wallpaper to the Dutch copy (null = not a wallpaper error). */
export function wallpaperErrorText(e: unknown): string | null {
  const m = String((e as { message?: string } | null)?.message ?? e ?? '');
  for (const t of Object.values(WALLPAPER_ERRORS)) if (m.includes(t)) return t;
  if (/not a member/i.test(m)) return WALLPAPER_ERRORS.notMember;
  if (/invalid wallpaper/i.test(m)) return WALLPAPER_ERRORS.invalid;
  if (/invalid (wallpaper )?photo|bad photo/i.test(m)) return WALLPAPER_ERRORS.badPhoto;
  return null;
}
