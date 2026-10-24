/** Step 4 (chat): pure logic for retention, screenshots, streaks, typing, reactions, voice notes and calls. No I/O. */

// ---------- Retention (disappearing messages) ----------
export type RetentionMode = 'after_view' | '24h' | 'keep';
export const RETENTION_MODES: RetentionMode[] = ['after_view', '24h', 'keep'];
export const RETENTION_LABEL: Record<RetentionMode, string> = {
  after_view: 'Na bekijken verwijderen',
  '24h': '24 uur na bekijken',
  keep: 'Altijd bewaren',
};
export const RETENTION_SHORT: Record<RetentionMode, string> = { after_view: 'Na bekijken', '24h': '24 u', keep: 'Bewaren' };
const DAY_MS = 86400000;
/** Grace period for "after viewing": the message stays while the chat is open, then disappears once you leave. */
export function parseRetention(v: unknown): RetentionMode {
  return v === 'after_view' || v === '24h' || v === 'keep' ? v : '24h';
}
/** Expiry (ms epoch) for a message. Unviewed messages never expire client-side (server fallback handles unopened ones).
 *  after_view: expires when the viewer leaves the chat (`leftAt`), or immediately if viewed in an earlier session.
 *  24h: viewedAt + 24 h. keep: never. Saved messages never expire. */
export function messageExpiry(mode: RetentionMode, viewedAt: number | null, opts: { saved?: boolean; leftAt?: number | null } = {}): number | null {
  if (opts.saved || mode === 'keep' || viewedAt === null) return null;
  if (mode === '24h') return viewedAt + DAY_MS;
  return opts.leftAt ?? null;
}
export function isMessageVisible(mode: RetentionMode, viewedAt: number | null, now: number, opts: { saved?: boolean; leftAt?: number | null } = {}): boolean {
  const exp = messageExpiry(mode, viewedAt, opts);
  return exp === null || now < exp;
}
/** Dutch remaining-time label for a bubble ("nog 3 u", "verdwijnt bij sluiten"), or null. */
export function retentionHint(mode: RetentionMode, viewedAt: number | null, now: number, saved = false): string | null {
  if (saved) return 'Bewaard';
  if (mode === 'keep' || viewedAt === null) return null;
  if (mode === 'after_view') return 'Verdwijnt bij sluiten';
  const left = viewedAt + DAY_MS - now;
  if (left <= 0) return 'Verlopen';
  const h = Math.floor(left / 3600000);
  return h >= 1 ? `Nog ${h} u` : `Nog ${Math.max(1, Math.ceil(left / 60000))} min`;
}
export function retentionChangeText(actor: string, mode: RetentionMode): string {
  return mode === 'keep' ? `${actor} bewaart chats in dit gesprek voortaan` : `${actor} zette chats op: ${RETENTION_LABEL[mode].toLowerCase()}`;
}

// ---------- Screenshot notification ----------
export function screenshotText(actor: string, isMe: boolean): string {
  return isMe ? 'Je hebt een screenshot van de chat gemaakt' : `${actor} heeft een screenshot van de chat gemaakt`;
}
/** Debounce: ignore repeated screenshot events within `windowMs` (OS can fire several). */
export function shouldReportScreenshot(lastAt: number | null, now: number, windowMs = 3000): boolean {
  return lastAt === null || now - lastAt >= windowMs;
}

// ---------- Streaks ----------
/** Local calendar day key (YYYY-MM-DD) for a timestamp at a UTC offset in minutes (Amsterdam summer = 120). */
export function dayKey(ms: number, offsetMin = 0): string {
  return new Date(ms + offsetMin * 60000).toISOString().slice(0, 10);
}
function prevDay(key: string): string { return new Date(Date.parse(key + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10); }
export type StreakEvent = { senderId: string; at: number };
export type StreakState = { count: number; atRisk: boolean; hoursLeft: number | null; todayMe: boolean; todayThem: boolean };
/** A streak day counts when BOTH people sent at least one snap that day. The streak is the run of consecutive
 *  such days ending today or yesterday. If today is not complete yet, the streak survives until the end of today;
 *  `atRisk` (⌛) is set when fewer than `warnHours` remain. */
export function computeStreak(events: StreakEvent[], me: string, them: string, now: number, offsetMin = 0, warnHours = 4): StreakState {
  const days = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.senderId !== me && e.senderId !== them) continue;
    const k = dayKey(e.at, offsetMin);
    (days.get(k) ?? days.set(k, new Set()).get(k)!).add(e.senderId);
  }
  const both = (k: string) => { const s = days.get(k); return !!s && s.has(me) && s.has(them); };
  const today = dayKey(now, offsetMin);
  const todayMe = !!days.get(today)?.has(me), todayThem = !!days.get(today)?.has(them);
  let k = both(today) ? today : prevDay(today), count = 0;
  while (both(k)) { count++; k = prevDay(k); }
  const endOfToday = Date.parse(today + 'T00:00:00Z') + DAY_MS - offsetMin * 60000;
  const hoursLeft = count > 0 && !both(today) ? (endOfToday - now) / 3600000 : null;
  return { count, atRisk: hoursLeft !== null && hoursLeft < warnHours, hoursLeft, todayMe, todayThem };
}
export function streakLabel(s: StreakState): string { return s.count < 1 ? '' : `${s.count}🔥${s.atRisk ? '⌛' : ''}`; }
export function streakHint(s: StreakState): string | null {
  if (!s.atRisk || s.hoursLeft === null) return null;
  const who = !s.todayMe && !s.todayThem ? 'Jullie moeten allebei' : !s.todayMe ? 'Jij moet nog' : 'Je vriend moet nog';
  return `${who} vandaag een snap sturen — nog ${Math.max(1, Math.ceil(s.hoursLeft))} u`;
}

// ---------- Typing indicator ----------
export const TYPING_TTL_MS = 5000;
export const TYPING_THROTTLE_MS = 2000;
export function shouldSendTyping(lastSentAt: number | null, now: number, text: string): boolean {
  return text.trim().length > 0 && (lastSentAt === null || now - lastSentAt >= TYPING_THROTTLE_MS);
}
export type TypingMap = Record<string, number>;
export function applyTyping(map: TypingMap, userId: string, typing: boolean, now: number): TypingMap {
  const next = { ...map };
  if (typing) next[userId] = now; else delete next[userId];
  return next;
}
export function activeTypers(map: TypingMap, now: number, exclude?: string): string[] {
  return Object.keys(map).filter(u => u !== exclude && now - map[u] < TYPING_TTL_MS).sort();
}
export function typingText(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return `${names[0]} is aan het typen…`;
  if (names.length === 2) return `${names[0]} en ${names[1]} zijn aan het typen…`;
  return `${names.length} mensen zijn aan het typen…`;
}

// ---------- Reactions ----------
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍', '👎'] as const;
export type Reaction = { messageId: string; userId: string; emoji: string };
/** One reaction per user per message (like Snapchat): same emoji toggles off, another replaces it. */
export function toggleReaction(list: Reaction[], messageId: string, userId: string, emoji: string): Reaction[] {
  const existing = list.find(r => r.messageId === messageId && r.userId === userId);
  const rest = list.filter(r => r !== existing);
  return existing?.emoji === emoji ? rest : [...rest, { messageId, userId, emoji }];
}
export function summarizeReactions(list: Reaction[], messageId: string, me: string): { emoji: string; count: number; mine: boolean }[] {
  const out = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of list) {
    if (r.messageId !== messageId) continue;
    const v = out.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    v.count++; if (r.userId === me) v.mine = true; out.set(r.emoji, v);
  }
  return [...out.values()].sort((a, b) => b.count - a.count || REACTION_EMOJIS.indexOf(a.emoji as never) - REACTION_EMOJIS.indexOf(b.emoji as never));
}

// ---------- Voice notes ----------
export const VOICE_MAX_MS = 60000;
export const VOICE_MIN_MS = 700;
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** Deterministic pseudo-waveform (0.15..1) from a seed string, for a stable look without decoding audio. */
export function waveform(seed: string, bars = 28): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out.push(Math.round((0.15 + (h % 1000) / 1000 * 0.85) * 100) / 100); }
  return out;
}
/** Normalize a metering value (dBFS, -160..0) into 0..1 for a live recording meter. */
export function meterLevel(db: number | undefined | null): number {
  if (db == null || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 60));
}
export function playbackProgress(positionMs: number, durationMs: number): number {
  return durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
}
/** Too-short recordings are discarded (accidental tap). */
export function keepRecording(durationMs: number): boolean { return durationMs >= VOICE_MIN_MS; }

// ---------- Video call (mock UI state machine) ----------
export type CallState = 'ringing' | 'connecting' | 'active' | 'ended';
export type CallEvent = 'answer' | 'connected' | 'hangup' | 'timeout';
export function nextCallState(s: CallState, e: CallEvent): CallState {
  if (e === 'hangup' || s === 'ended') return 'ended';
  if (s === 'ringing') return e === 'answer' ? 'connecting' : e === 'timeout' ? 'ended' : s;
  if (s === 'connecting') return e === 'connected' ? 'active' : e === 'timeout' ? 'ended' : s;
  return s;
}
export function callStatusText(s: CallState, elapsedMs: number): string {
  return s === 'ringing' ? 'Bellen…' : s === 'connecting' ? 'Verbinden…' : s === 'active' ? formatDuration(elapsedMs) : 'Gesprek beëindigd';
}
