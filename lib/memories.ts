/** Pure logic for Herinneringen: grouping by date, 'Alleen voor mij' PIN, 'Op deze dag' and re-send payloads. */
export type Memory = {id: string; storage_path: string; media_type: 'photo' | 'video'; created_at: string; private?: boolean; caption?: string | null};
export type MemorySection = {key: string; title: string; items: Memory[]};
const MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const DAY = 86400000;
/** Local calendar day key YYYY-MM-DD (timezone offset in minutes, e.g. -120 for UTC+2 as Date#getTimezoneOffset). */
export function dayKey(iso: string, tzOffsetMin = 0): string {
  return new Date(Date.parse(iso) - tzOffsetMin * 60000).toISOString().slice(0, 10);
}
export function sectionTitle(key: string, todayKey: string): string {
  const diff = Math.round((Date.parse(todayKey) - Date.parse(key)) / DAY);
  if (diff === 0) return 'Vandaag';
  if (diff === 1) return 'Gisteren';
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${key.slice(0, 4) === todayKey.slice(0, 4) ? '' : ` ${y}`}`;
}
/** Newest first, grouped per day. Private memories are excluded unless `includePrivate`. */
export function groupByDate(items: Memory[], now: number, opts: {tzOffsetMin?: number; includePrivate?: boolean} = {}): MemorySection[] {
  const tz = opts.tzOffsetMin ?? 0, today = dayKey(new Date(now).toISOString(), tz);
  const map = new Map<string, Memory[]>();
  for (const m of [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (m.private && !opts.includePrivate) continue;
    const k = dayKey(m.created_at, tz);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  }
  return [...map].map(([key, list]) => ({key, title: sectionTitle(key, today), items: list}));
}
/** Memories from the same calendar day in earlier years (never private ones). */
export function onThisDay(items: Memory[], now: number, tzOffsetMin = 0): {yearsAgo: number; items: Memory[]}[] {
  const today = dayKey(new Date(now).toISOString(), tzOffsetMin), md = today.slice(5), year = +today.slice(0, 4);
  const byYear = new Map<number, Memory[]>();
  for (const m of items) {
    if (m.private) continue;
    const k = dayKey(m.created_at, tzOffsetMin), y = +k.slice(0, 4);
    if (k.slice(5) !== md || y >= year) continue;
    if (!byYear.has(year - y)) byYear.set(year - y, []);
    byYear.get(year - y)!.push(m);
  }
  return [...byYear].sort((a, b) => a[0] - b[0]).map(([yearsAgo, list]) => ({yearsAgo, items: list}));
}
export const flashbackTitle = (yearsAgo: number) => `Op deze dag · ${yearsAgo} jaar geleden`;

// ---- PIN ('Alleen voor mij') ----
export const PIN_LENGTH = 4;
export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'Gebruik alleen cijfers.';
  if (pin.length !== PIN_LENGTH) return `De pincode moet ${PIN_LENGTH} cijfers hebben.`;
  if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Kies een minder voorspelbare pincode.';
  return null;
}
/** Salted hash. `digest` is injected (expo-crypto in the app, node:crypto in tests) so this stays pure. */
export async function hashPin(pin: string, salt: string, digest: (s: string) => Promise<string>): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < 1000; i++) h = await digest(h);
  return h;
}
export type PinLock = {failures: number; lockedUntil: number | null};
export const PIN_MAX_TRIES = 5;
export function registerPinAttempt(lock: PinLock, ok: boolean, now: number): PinLock {
  if (ok) return {failures: 0, lockedUntil: null};
  const failures = lock.failures + 1;
  // After 5 wrong tries: 30 s lock, doubling each further failure, capped at 1 h.
  const lockedUntil = failures >= PIN_MAX_TRIES ? now + Math.min(3600000, 30000 * 2 ** (failures - PIN_MAX_TRIES)) : null;
  return {failures, lockedUntil};
}
export const isLocked = (l: PinLock, now: number) => !!l.lockedUntil && l.lockedUntil > now;
export function lockText(l: PinLock, now: number): string {
  if (isLocked(l, now)) return `Te vaak fout. Probeer het over ${Math.ceil((l.lockedUntil! - now) / 1000)} s opnieuw.`;
  if (l.failures) return `Onjuiste pincode. Nog ${Math.max(0, PIN_MAX_TRIES - l.failures)} pogingen.`;
  return '';
}

// ---- save / re-send ----
export function memoryInsert(ownerId: string, storagePath: string, mediaType: 'photo' | 'video', caption: string | null, source: 'snap' | 'story' = 'snap') {
  return {owner_id: ownerId, storage_path: storagePath, media_type: mediaType, caption: caption || null, source, private: false};
}
/** Message rows for re-sending a memory to several chats (snap expires after 24 h like normal snaps). */
export function resendMessages(m: Memory, senderId: string, threadIds: string[], now: number) {
  if (m.media_type !== 'photo' && m.media_type !== 'video') throw new Error('Onbekend mediatype');
  return [...new Set(threadIds)].map(thread_id => ({thread_id, sender_id: senderId, kind: 'snap' as const, body: m.caption || null, media_path: m.storage_path, expires_at: new Date(now + DAY).toISOString()}));
}
export function togglePrivate(items: Memory[], id: string, value: boolean): Memory[] {
  return items.map(m => m.id === id ? {...m, private: value} : m);
}
