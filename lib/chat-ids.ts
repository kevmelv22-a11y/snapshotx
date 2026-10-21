/**
 * Guards so the chat/friend flows never send a non-UUID (demo id, '', 'undefined', '@handle', a route array)
 * to a uuid column, and so best-effort system lines (screenshot notice) never surface a DB error.
 * Pure (no React Native imports) so it can be unit-tested with `node --test`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

/** expo-router params can be string | string[] | undefined; returns the thread uuid or null. */
export function threadIdFromParam(p: unknown): string | null {
  const v = Array.isArray(p) ? p[0] : p;
  return isUuid(v) ? v.trim().toLowerCase() : null;
}

/** Unique, valid uuids only (drops demo ids such as 'demo-1', '', null, '@handle'). */
export function uuidList(ids: readonly unknown[]): string[] {
  return [...new Set(ids.filter(isUuid).map(x => x.trim().toLowerCase()))];
}

/** Max body length of a system line (sx_messages_system_no_media check in 20261013150000_chat_step4). */
export const SYSTEM_BODY_MAX = 200;

/** Row for a system line, or null when it cannot be valid (bad ids / empty text). */
export function systemMessageRow(threadId: unknown, senderId: unknown, text: string) {
  const body = (text || '').trim().slice(0, SYSTEM_BODY_MAX);
  if (!isUuid(threadId) || !isUuid(senderId) || !body) return null;
  return { thread_id: threadId, sender_id: senderId, kind: 'system' as const, body, media_path: null, expires_at: null };
}

type Err = { code?: unknown; message?: unknown } | null | undefined;
/**
 * A system line is a courtesy (e.g. "X heeft een screenshot gemaakt"). When the server does not accept
 * kind='system' yet (live DB without 20261013150000_chat_step4: old sx_messages_kind_check → 23514) or the
 * row is otherwise rejected as invalid, the user must not get a yellow "Ongeldige invoer" banner.
 */
export function isSilentSystemMessageError(e: Err): boolean {
  if (!e) return false;
  const code = String(e.code ?? ''), msg = String(e.message ?? '');
  return /^(23514|22P02|23502|42703|PGRST204)$/.test(code) || /violates check constraint|invalid input syntax/i.test(msg);
}
