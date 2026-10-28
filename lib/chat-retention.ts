/** Snapchat "Chats verwijderen" semantics per message (2026-10-28).
 *  Snapchat: "Messages sent after retention is changed will reflect the new settings, but older messages will still
 *  reflect the settings from when they were originally sent." So every chat carries the retention mode that was active
 *  when it was SENT (sx_messages.retention_mode, stamped server-side by migration 20261028030000_message_retention_mode.sql).
 *  Before this, the app judged every message by the chat's CURRENT mode: switching to "Bewaren" made already-timed
 *  chats look kept while the server still deleted them ("vanish"), and switching away from "Bewaren" hid old kept chats.
 *  Pure, no I/O. */
import { RETENTION_LABEL, isMessageVisible, parseRetention, type RetentionMode } from './chat-features';

export type RetentionRow = { id: string; kind: string; body: string | null; created_at: string; sender_id?: string; saved?: boolean; expires_at?: string | null; retention_mode?: string | null };

const isMode = (v: unknown): v is RetentionMode => v === 'after_view' || v === '24h' || v === 'keep';
/** Server default for threads before any change (20261013150000_chat_step4.sql). */
export const DEFAULT_RETENTION: RetentionMode = '24h';

/** Mode from a retention system line written by retentionChangeText ("… bewaart chats in dit gesprek voortaan",
 *  "… zette chats op: 24 uur na bekijken"). null = not a retention line. */
export function retentionFromChangeText(body: string | null | undefined): RetentionMode | null {
  if (!body) return null;
  if (body.endsWith(' bewaart chats in dit gesprek voortaan')) return 'keep';
  const m = body.match(/ zette chats op: (.+)$/);
  if (!m) return null;
  for (const mode of ['after_view', '24h', 'keep'] as RetentionMode[]) if (RETENTION_LABEL[mode].toLowerCase() === m[1]) return mode;
  return null;
}

/** Retention mode each message was sent with. Stamped rows win; legacy rows (before the migration) use the latest
 *  retention line before them; with no earlier line, the current mode if the chat never changed, else the server default. */
export function sentModes(rows: readonly RetentionRow[], threadMode: RetentionMode): Record<string, RetentionMode> {
  const asc = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const anyChange = asc.some(r => r.kind === 'system' && retentionFromChangeText(r.body));
  let cur: RetentionMode = anyChange ? DEFAULT_RETENTION : threadMode;
  const out: Record<string, RetentionMode> = {};
  for (const r of asc) {
    if (r.kind === 'system') { cur = retentionFromChangeText(r.body) ?? cur; continue; }
    out[r.id] = isMode(r.retention_mode) ? r.retention_mode : cur;
  }
  return out;
}

/** Mode a message was sent with (single row helper). */
export function modeOf(row: RetentionRow, modes: Record<string, RetentionMode>, threadMode: RetentionMode): RetentionMode {
  return modes[row.id] ?? (isMode(row.retention_mode) ? row.retention_mode : parseRetention(threadMode));
}

/** The server already set a deletion time that has passed (cleanup may lag) → hide, unless saved in chat. */
export function serverExpired(row: RetentionRow, now: number): boolean {
  if (row.saved || !row.expires_at) return false;
  const t = Date.parse(row.expires_at);
  return Number.isFinite(t) && t <= now;
}

/** Visibility of a received message: its own (sent-with) mode + the server's expiry + Snapchat's 31-day cap. */
export function isVisibleAsSent(row: RetentionRow, mode: RetentionMode, viewedAt: number | null, now: number, leftAt: number | null): boolean {
  if (serverExpired(row, now)) return false;
  const createdAt = Date.parse(row.created_at);
  return isMessageVisible(mode, viewedAt, now, { saved: row.saved, leftAt, createdAt: Number.isFinite(createdAt) ? createdAt : null });
}

/** Messages that still disappear on their old timer although the chat is now set to `threadMode`
 *  (shown in the "Chats verwijderen" sheet so switching to Bewaren is never a surprise). */
export function pendingOldTimers(rows: readonly RetentionRow[], modes: Record<string, RetentionMode>, threadMode: RetentionMode): number {
  if (threadMode !== 'keep') return 0;
  return rows.filter(r => r.kind !== 'system' && r.kind !== 'snap' && !r.saved && (modes[r.id] ?? threadMode) !== 'keep').length;
}

export const UNOPENED_NOTE = 'Ongeopende chats worden na 31 dagen verwijderd.';
export const RETENTION_FORWARD_NOTE = 'Een nieuwe instelling geldt voor chats die vanaf nu worden verstuurd. Eerdere chats verdwijnen volgens de instelling van toen.';
export function pendingOldTimersText(n: number): string | null {
  if (n <= 0) return null;
  return `${n === 1 ? '1 eerdere chat verdwijnt' : `${n} eerdere chats verdwijnen`} nog volgens de oude instelling. Houd een chat ingedrukt en kies Opslaan in chat om hem te bewaren.`;
}

/** Snapchat (support, "When does Snapchat delete Snaps and Chats?", checked 2026-10-28): "Chats are automatically
 *  deleted by default 24 hours after EVERYONE in the conversation has viewed the Chat … or 31 days after the Chat was
 *  sent, whichever is sooner." The server already starts the timer at the last member's receipt
 *  (app_private.sx_apply_retention, 20261028060000_unopened_chats_31d.sql). Before this, the app started the 24 h at
 *  YOUR OWN view, so in a group a chat vanished for you while others still hadn't opened it (and the sender kept it forever).
 *  Now the deletion timer starts when the last other member (everyone except the sender) has opened the chat. */
export type ReceiptRow = { message_id: string; user_id: string; opened_at: string | null };
/** Per message: user id → opened-at (ms). Unopened / invalid receipts are skipped. */
export function receiptIndex(receipts: readonly ReceiptRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of receipts) {
    if (!r.opened_at) continue;
    const t = Date.parse(r.opened_at); if (!Number.isFinite(t)) continue;
    const per = (out[r.message_id] ??= {});
    per[r.user_id] = per[r.user_id] === undefined ? t : Math.min(per[r.user_id], t);
  }
  return out;
}
/** Moment EVERY member except the sender had opened the message (= latest of their first opens), or null while
 *  someone hasn't. Members who left are not waited for. A chat with no other members never starts a timer. */
export function everyoneViewedAt(senderId: string, memberIds: readonly string[], opens: Readonly<Record<string, number>> | undefined, sentAt: number | null = null, leaves: readonly LeaveEvent[] = []): number | null {
  const others = [...new Set(memberIds)].filter(u => u !== senderId);
  if (!others.length || !opens) return null;
  let last = -Infinity;
  for (const u of others) { const t = opens[u]; if (t === undefined) return null; last = Math.max(last, t); }
  // Members who left after the chat was sent: a viewer counts with their view; someone who left WITHOUT viewing it
  // completed "everyone viewed" only at the moment they left → the timer starts then (not at an older view, which
  // made the chat vanish the instant a member left). Unknown leavers (name not resolvable) count as unviewed (later = safe).
  const current = new Set(others);
  for (const l of leaves) {
    if (sentAt === null || l.at < sentAt || l.userId === senderId || (l.userId !== null && current.has(l.userId))) continue;
    const viewed = l.userId === null ? undefined : opens[l.userId];
    last = Math.max(last, viewed !== undefined && viewed <= l.at ? viewed : l.at);
  }
  return last;
}

/** A member leaving ("X heeft de groep verlaten", sender = the leaver) or being removed ("A heeft X uit de groep verwijderd"). */
export type LeaveEvent = { at: number; userId: string | null };
const LEAVE_RE = /^(.+) heeft de groep verlaten$/, REMOVE_RE = /^.+? heeft (.+) uit de groep verwijderd$/;
/** Leave / remove events from the thread's system lines. `idOfName` resolves a removed member's display name (null = unknown). */
export function leaveEvents(rows: readonly Pick<RetentionRow, 'kind' | 'body' | 'created_at' | 'sender_id'>[], idOfName: (name: string) => string | null): LeaveEvent[] {
  const out: LeaveEvent[] = [];
  for (const r of rows) {
    if (r.kind !== 'system' || !r.body) continue;
    const at = Date.parse(r.created_at); if (!Number.isFinite(at)) continue;
    if (LEAVE_RE.test(r.body)) { out.push({ at, userId: r.sender_id ?? idOfName(r.body.match(LEAVE_RE)![1]) }); continue; }
    const m = r.body.match(REMOVE_RE); if (m) out.push({ at, userId: idOfName(m[1]) });
  }
  return out;
}

/** Name → id over known people; ambiguous names (two people called "Tim") resolve to null. */
export function nameResolver(people: readonly { id: string; name: string | null | undefined }[]): (name: string) => string | null {
  const map = new Map<string, string | null>();
  for (const p of people) { const n = p.name?.trim(); if (!n) continue; map.set(n, map.has(n) && map.get(n) !== p.id ? null : p.id); }
  return name => map.get(name.trim()) ?? null;
}
/** Deletion-timer start for every non-system message: everyone viewed (from the receipts), with `ownViews` (receipts
 *  just written optimistically by this device) merged in for `me`. Messages nobody finished viewing are absent. */
export function timerStarts(rows: readonly Pick<RetentionRow, 'id' | 'kind' | 'sender_id' | 'created_at'>[], memberIds: readonly string[], idx: Readonly<Record<string, Record<string, number>>>, me: string, ownViews: Readonly<Record<string, number>> = {}, leaves: readonly LeaveEvent[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.kind === 'system' || !r.sender_id) continue;
    const opens = { ...(idx[r.id] ?? {}) };
    if (ownViews[r.id] !== undefined && opens[me] === undefined) opens[me] = ownViews[r.id];
    const sent = Date.parse(r.created_at);
    const t = everyoneViewedAt(r.sender_id, memberIds, opens, Number.isFinite(sent) ? sent : null, leaves);
    if (t !== null) out[r.id] = t;
  }
  return out;
}
/** Visibility in the chat (own and received): the sent-with mode's timer counts from `timerStart` (everyone viewed).
 *  "Na bekijken": gone once everyone had viewed it before this chat session started. Snaps keep their own rules. */
export function isVisibleForEveryone(row: RetentionRow, mode: RetentionMode, timerStart: number | null, now: number, sessionStart: number): boolean {
  if (row.kind === 'system') return true;
  return isVisibleAsSent(row, mode, timerStart, now, timerStart !== null && timerStart < sessionStart ? sessionStart : null);
}

/** Chat list (Snapchat): a row's preview / status / unread dot / time only use chats that still exist for you — the same
 *  rules as the chat screen (sent-with mode, everyone viewed incl. members who left, server expiry, 31-day cap).
 *  Before this the list used the newest row even when it had already disappeared ("Nieuwe chat" for a vanished chat).
 *  Snaps and system lines keep their own (status) rules. Opening the list counts as having left any "Na bekijken" chat. */
export function listVisibleRows<T extends RetentionRow>(rows: readonly T[], threadMode: RetentionMode, memberIds: readonly string[], receipts: readonly ReceiptRow[], me: string, now: number, idOfName: (name: string) => string | null = () => null): T[] {
  const modes = sentModes(rows, threadMode);
  const leaves = leaveEvents(rows, idOfName);
  const starts = timerStarts(rows.filter(r => r.kind !== 'snap'), memberIds, receiptIndex(receipts), me, {}, leaves);
  return rows.filter(r => r.kind === 'system' || r.kind === 'snap' || isVisibleForEveryone(r, modes[r.id] ?? threadMode, starts[r.id] ?? null, now, now));
}
