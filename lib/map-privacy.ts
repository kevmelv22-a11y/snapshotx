/** Pure logic for map privacy: spookmodus (timed), audience (all / selected / none) and last-seen texts. */
export type GhostDuration = '3h' | '24h' | 'until_off';
export type ShareAudience = 'all' | 'selected' | 'none';
export type MapPrivacy = {ghostUntil: string | null; ghostForever: boolean; audience: ShareAudience; allowedIds: string[]};
export const DEFAULT_PRIVACY: MapPrivacy = {ghostUntil: null, ghostForever: false, audience: 'none', allowedIds: []};
const H = 3600000;
export const GHOST_OPTIONS: {key: GhostDuration; label: string}[] = [
  {key: '3h', label: '3 uur'}, {key: '24h', label: '24 uur'}, {key: 'until_off', label: 'Tot ik het uitzet'},
];
export const AUDIENCE_OPTIONS: {key: ShareAudience; label: string; hint: string}[] = [
  {key: 'all', label: 'Alle vrienden', hint: 'Al je vrienden zien waar je bent.'},
  {key: 'selected', label: 'Alleen geselecteerde vrienden', hint: 'Kies zelf wie je ziet.'},
  {key: 'none', label: 'Niemand', hint: 'Je locatie wordt met niemand gedeeld.'},
];

export function enableGhost(p: MapPrivacy, d: GhostDuration, now: number): MapPrivacy {
  if (d === 'until_off') return {...p, ghostForever: true, ghostUntil: null};
  return {...p, ghostForever: false, ghostUntil: new Date(now + (d === '3h' ? 3 : 24) * H).toISOString()};
}
export const disableGhost = (p: MapPrivacy): MapPrivacy => ({...p, ghostForever: false, ghostUntil: null});
export function isGhost(p: MapPrivacy, now: number): boolean {
  return p.ghostForever || (!!p.ghostUntil && Date.parse(p.ghostUntil) > now);
}
/** Dutch status line for the ghost chip, e.g. "Spookmodus · nog 2 u 15 min". */
export function ghostStatusText(p: MapPrivacy, now: number): string {
  if (!isGhost(p, now)) return 'Spookmodus uit';
  if (p.ghostForever) return 'Spookmodus aan tot je hem uitzet';
  const left = Math.max(0, Date.parse(p.ghostUntil!) - now), h = Math.floor(left / H), m = Math.ceil((left % H) / 60000);
  if (m === 60) return `Spookmodus · nog ${h + 1} u`;
  return `Spookmodus · nog ${h ? `${h} u ` : ''}${m} min`.replace(/ 0 min$/, '');
}
export function toggleAllowed(p: MapPrivacy, id: string): MapPrivacy {
  const has = p.allowedIds.includes(id);
  return {...p, allowedIds: has ? p.allowedIds.filter(x => x !== id) : [...p.allowedIds, id]};
}
/** Whether `viewerId` may see the owner's location (mirrors the RLS policy in the migration). */
export function canFriendSee(p: MapPrivacy, viewerId: string, now: number): boolean {
  if (isGhost(p, now)) return false;
  if (p.audience === 'all') return true;
  if (p.audience === 'selected') return p.allowedIds.includes(viewerId);
  return false;
}
/** Is the user's own location being shared with at least one person right now? */
export const isSharing = (p: MapPrivacy, now: number) => !isGhost(p, now) && (p.audience === 'all' || (p.audience === 'selected' && p.allowedIds.length > 0));
export function sharingSummary(p: MapPrivacy, now: number): string {
  if (isGhost(p, now)) return ghostStatusText(p, now);
  if (p.audience === 'all') return 'Zichtbaar voor alle vrienden';
  if (p.audience === 'selected') return p.allowedIds.length ? `Zichtbaar voor ${p.allowedIds.length} vriend${p.allowedIds.length === 1 ? '' : 'en'}` : 'Geen vrienden geselecteerd';
  return 'Je locatie is verborgen';
}
/** "Nu", "5 min geleden", "2 u geleden", "gisteren", "3 dagen geleden". */
export function lastSeenText(updatedAt: string | number, now: number): string {
  const diff = Math.max(0, now - (typeof updatedAt === 'number' ? updatedAt : Date.parse(updatedAt)));
  const min = Math.floor(diff / 60000);
  if (min < 2) return 'Nu';
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} u geleden`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Gisteren' : `${d} dagen geleden`;
}
/** Live = updated in the last 15 minutes (pin rendered at full opacity). */
export const isLive = (updatedAt: string, now: number) => now - Date.parse(updatedAt) < 15 * 60000;
/** Parse a DB row (new columns may be missing on older schemas). */
export function privacyFromRow(row: Partial<{ghost_until: string | null; ghost_forever: boolean; share_audience: string; sharing: boolean}> | null | undefined, allowedIds: string[] = []): MapPrivacy {
  if (!row) return DEFAULT_PRIVACY;
  const audience: ShareAudience = row.share_audience === 'all' || row.share_audience === 'selected' || row.share_audience === 'none' ? row.share_audience : row.sharing ? 'all' : 'none';
  return {ghostUntil: row.ghost_until ?? null, ghostForever: !!row.ghost_forever, audience, allowedIds};
}
/** `sharing` reflects the audience only; timed ghost mode is enforced by RLS via ghost_until, so it expires
 *  server-side without the app having to come back online. */
export function privacyToRow(p: MapPrivacy) {
  return {ghost_until: p.ghostUntil, ghost_forever: p.ghostForever, share_audience: p.audience, sharing: p.audience !== 'none'};
}
