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

/** Visibility of a received message: its own (sent-with) mode + the server's expiry. */
export function isVisibleAsSent(row: RetentionRow, mode: RetentionMode, viewedAt: number | null, now: number, leftAt: number | null): boolean {
  if (serverExpired(row, now)) return false;
  return isMessageVisible(mode, viewedAt, now, { saved: row.saved, leftAt });
}

/** Messages that still disappear on their old timer although the chat is now set to `threadMode`
 *  (shown in the "Chats verwijderen" sheet so switching to Bewaren is never a surprise). */
export function pendingOldTimers(rows: readonly RetentionRow[], modes: Record<string, RetentionMode>, threadMode: RetentionMode): number {
  if (threadMode !== 'keep') return 0;
  return rows.filter(r => r.kind !== 'system' && r.kind !== 'snap' && !r.saved && (modes[r.id] ?? threadMode) !== 'keep').length;
}

export const RETENTION_FORWARD_NOTE = 'Een nieuwe instelling geldt voor chats die vanaf nu worden verstuurd. Eerdere chats verdwijnen volgens de instelling van toen.';
export function pendingOldTimersText(n: number): string | null {
  if (n <= 0) return null;
  return `${n === 1 ? '1 eerdere chat verdwijnt' : `${n} eerdere chats verdwijnen`} nog volgens de oude instelling. Houd een chat ingedrukt en kies Opslaan in chat om hem te bewaren.`;
}
