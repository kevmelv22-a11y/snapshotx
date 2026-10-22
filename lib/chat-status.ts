/**
 * Snapchat-style chat status (chat list rows + snap lines in a chat). Pure, no I/O, testable with `npx tsx --test`.
 *
 * Snapchat's legend:
 *  - colour = content: red = snap without sound (photo), purple = snap with sound (video), blue = chat
 *    (text, sticker, voice note, photo/video sent in chat).
 *  - shape = direction: arrow ➤ = you sent it, square ■ = you received it.
 *  - fill = state: filled = not opened yet (Bezorgd / Nieuwe snap / Nieuwe chat), outline = opened (Geopend / Ontvangen).
 *  - crossed arrows = someone made a screenshot. Grey speech bubble = nothing yet (Tik om te chatten).
 */
import { computeStreak, streakLabel, type StreakState } from './chat-features';

export type StatusTone = 'snap' | 'audio' | 'chat' | 'idle';
export type StatusShape = 'arrow' | 'square' | 'screenshot' | 'bubble';
export type ChatStatus = { tone: StatusTone; shape: StatusShape; filled: boolean; label: string; mine: boolean; unopened: boolean };

export const STATUS_COLOR: Record<StatusTone, string> = { snap: '#F23C57', audio: '#A05DCD', chat: '#0EADFF', idle: '#9A93A8' };

export type StatusMessage = { id: string; sender_id: string; kind: string; body: string | null; created_at: string };

/** Content colour of a message. A snap whose body is 'video' is a snap with sound (purple). */
export function messageTone(m: Pick<StatusMessage, 'kind' | 'body'>): StatusTone {
  if (m.kind === 'snap') return m.body === 'video' ? 'audio' : 'snap';
  return 'chat';
}

/** True for the "… heeft een screenshot van de chat gemaakt" system line (see chat-features screenshotText). */
export function isScreenshotLine(m: Pick<StatusMessage, 'kind' | 'body'>): boolean {
  return m.kind === 'system' && /screenshot/i.test(m.body ?? '');
}

/**
 * Status for one message from the viewer's point of view.
 * `openedByPeer`: (my message) at least one other member opened it. `openedByMe`: (their message) I opened it.
 */
export function messageStatus(m: StatusMessage, me: string, openedByPeer: boolean, openedByMe: boolean): ChatStatus {
  if (isScreenshotLine(m)) return { tone: 'chat', shape: 'screenshot', filled: false, label: m.sender_id === me ? 'Screenshot gemaakt' : 'Screenshot!', mine: m.sender_id === me, unopened: false };
  const tone = messageTone(m), mine = m.sender_id === me;
  if (mine) return { tone, shape: 'arrow', filled: !openedByPeer, label: openedByPeer ? 'Geopend' : 'Bezorgd', mine, unopened: !openedByPeer };
  const what = tone === 'chat' ? 'chat' : 'snap';
  return { tone, shape: 'square', filled: !openedByMe, label: openedByMe ? 'Ontvangen' : `Nieuwe ${what}`, mine, unopened: !openedByMe };
}

export const IDLE_STATUS: ChatStatus = { tone: 'idle', shape: 'bubble', filled: false, label: 'Tik om te chatten', mine: false, unopened: false };

/**
 * Row status for a thread: the newest message that matters. Group-change / retention system lines are skipped
 * (Snapchat doesn't show them as a status); a screenshot line is shown when it is the newest event.
 * `messages` may be in any order. `peerOpened`: ids of MY messages opened by someone else. `meOpened`: ids I opened.
 */
export function threadStatus(messages: StatusMessage[], me: string, peerOpened: ReadonlySet<string>, meOpened: ReadonlySet<string>): ChatStatus {
  const sorted = [...messages].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const last = sorted.find(m => m.kind !== 'system' || isScreenshotLine(m));
  if (!last) return IDLE_STATUS;
  return messageStatus(last, me, peerOpened.has(last.id), meOpened.has(last.id));
}

/** Streak for a 1-on-1 thread (snaps both ways per day). Groups have no streaks on Snapchat. */
export function threadStreak(messages: Pick<StatusMessage, 'sender_id' | 'kind' | 'created_at'>[], me: string, peer: string | null, now: number, offsetMin: number): StreakState {
  return computeStreak(peer ? messages.filter(m => m.kind === 'snap').map(m => ({ senderId: m.sender_id, at: Date.parse(m.created_at) })) : [], me, peer ?? '', now, offsetMin);
}

/** Snapchat row subtitle: "Nieuwe snap · 12 m · 6🔥⌛" (parts that are empty are left out). */
export function statusLine(status: ChatStatus, time: string, streak?: StreakState | null): string {
  return [status.label, statusMeta(time, streak)].filter(Boolean).join(' · ');
}
/** The part after the label: "12 m · 6🔥". */
export function statusMeta(time: string, streak?: StreakState | null, glyphs?: { fire?: string; hourglass?: string }): string {
  return [time, streak ? streakLabel(streak, glyphs?.fire, glyphs?.hourglass) : ''].filter(Boolean).join(' · ');
}

/** Label for a snap bubble inside a chat (Snapchat shows a status line instead of the media). */
export function snapLine(status: ChatStatus, showing: boolean, canReplay = true): string {
  if (status.mine) return status.unopened ? 'Snap verstuurd · Bezorgd' : 'Snap verstuurd · Geopend';
  if (showing) return 'Snap wordt bekeken…';
  if (status.unopened) return 'Tik om snap te bekijken';
  return canReplay ? 'Snap geopend · tik om opnieuw te bekijken' : 'Snap geopend';
}

const WEEKDAYS = ['ZONDAG', 'MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'];
const MONTHS = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
/** Snapchat day divider in a chat: VANDAAG / GISTEREN / weekday (this week) / "12 OKT" (/"12 OKT 2025" other year).
 *  `offsetMin` = local UTC offset in minutes (east positive), so the label is computed in the viewer's zone. */
export function dayDivider(at: number, now: number, offsetMin = 0): string {
  const local = (ms: number) => new Date(ms + offsetMin * 60000);
  const dayNo = (ms: number) => Math.floor((ms + offsetMin * 60000) / 86400000);
  const diff = dayNo(now) - dayNo(at), d = local(at);
  if (diff <= 0) return 'VANDAAG';
  if (diff === 1) return 'GISTEREN';
  if (diff < 7) return WEEKDAYS[d.getUTCDay()];
  const label = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === local(now).getUTCFullYear() ? label : `${label} ${d.getUTCFullYear()}`;
}
/** Ids of messages (newest-first list) that start a new day, i.e. get a divider above them. */
export function dividerStarts(rows: { id: string; created_at: string }[], offsetMin = 0): Set<string> {
  const out = new Set<string>(), dayNo = (iso: string) => Math.floor((Date.parse(iso) + offsetMin * 60000) / 86400000);
  rows.forEach((m, i) => { const older = rows[i + 1]; if (!older || dayNo(older.created_at) !== dayNo(m.created_at)) out.add(m.id); });
  return out;
}
