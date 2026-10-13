/** Step 9: disappearing-content rules. Pure, no I/O; mirrored server-side by
 *  supabase/migrations/20261013190200_disappear_cleanup.sql (sx_disappear_cleanup). */
import type { RetentionMode } from '../chat-features';

export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
export const UNOPENED_SNAP_TTL_MS = 30 * DAY;
export const STORY_TTL_MS = 24 * HOUR;
export const AFTER_VIEW_GRACE_MS = 10 * MIN;
export const MAX_SNAP_TIMER_S = 10;

export type SnapLike = { kind: 'snap'; createdAt: number; timerS: number | null; openedAt: number | null; replayed?: boolean; saved?: boolean };
export type StoryLike = { kind: 'story'; createdAt: number };
export type ChatLike = { kind: 'chat'; createdAt: number; viewedAt: number | null; leftAt?: number | null; retention: RetentionMode; saved?: boolean };
export type Ephemeral = SnapLike | StoryLike | ChatLike;

/** Seconds a snap stays on screen once opened (null/0 = 'no limit' → treated as max timer). */
export function snapViewMs(timerS: number | null): number {
  const s = timerS && timerS > 0 ? Math.min(timerS, MAX_SNAP_TIMER_S) : MAX_SNAP_TIMER_S;
  return s * 1000;
}

/** Absolute deletion time, or null = keep. */
export function expiresAt(x: Ephemeral): number | null {
  switch (x.kind) {
    case 'story': return x.createdAt + STORY_TTL_MS;
    case 'snap':
      if (x.saved) return null;
      if (x.openedAt == null) return x.createdAt + UNOPENED_SNAP_TTL_MS;
      return x.openedAt + snapViewMs(x.timerS) * (x.replayed ? 2 : 1);
    case 'chat':
      if (x.saved || x.retention === 'keep' || x.viewedAt == null) return null;
      if (x.retention === '24h') return x.viewedAt + DAY;
      return (x.leftAt ?? x.viewedAt) + AFTER_VIEW_GRACE_MS;
  }
}

export function isExpired(x: Ephemeral, now: number): boolean { const e = expiresAt(x); return e != null && e <= now; }

export type Reason = 'viewed' | 'unopened-30d' | 'story-24h' | 'chat-retention';
export function expiryReason(x: Ephemeral): Reason {
  if (x.kind === 'story') return 'story-24h';
  if (x.kind === 'chat') return 'chat-retention';
  return x.openedAt == null ? 'unopened-30d' : 'viewed';
}

/** Split items into kept/deleted at `now` — what the scheduled cleanup does. */
export function sweep<T extends Ephemeral>(items: T[], now: number): { keep: T[]; deleted: { item: T; reason: Reason }[] } {
  const keep: T[] = [], deleted: { item: T; reason: Reason }[] = [];
  for (const it of items) if (isExpired(it, now)) deleted.push({ item: it, reason: expiryReason(it) }); else keep.push(it);
  return { keep, deleted };
}

export function remainingLabel(x: Ephemeral, now: number): string {
  const e = expiresAt(x);
  if (e == null) return 'bewaard';
  const ms = e - now;
  if (ms <= 0) return 'verlopen';
  if (ms < MIN) return `${Math.ceil(ms / 1000)}s`;
  if (ms < HOUR) return `${Math.ceil(ms / MIN)} min`;
  if (ms < DAY) return `${Math.ceil(ms / HOUR)} u`;
  return `${Math.ceil(ms / DAY)} d`;
}
