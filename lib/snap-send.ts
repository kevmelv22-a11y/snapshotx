import { dbErrorKind } from './db-errors';

type Row = Record<string, unknown> & { view_seconds?: number | null };
type Insert = (row: Row) => PromiseLike<{ error: unknown }>;

/** True when the server rejected the row only because sx_messages.view_seconds does not exist yet
 *  (migration 20261013120000_snap_view_seconds.sql not applied). */
export function isMissingViewSeconds(error: unknown): boolean {
  const msg = String((error as { message?: unknown } | null)?.message ?? '');
  return dbErrorKind(error) === 'missing_column' && /view_seconds/i.test(msg);
}

/** Inserts a snap message; if the server has no view_seconds column yet, retries without it so the snap
 *  still gets sent (the per-snap view timer is then simply not stored). */
export async function insertSnapMessage(insert: Insert, row: Row): Promise<{ error: unknown; droppedTimer: boolean }> {
  const first = await insert(row);
  if (!first.error || !isMissingViewSeconds(first.error) || !('view_seconds' in row)) return { error: first.error ?? null, droppedTimer: false };
  const rest: Row = { ...row };
  delete rest.view_seconds;
  const second = await insert(rest);
  return { error: second.error ?? null, droppedTimer: !second.error };
}
