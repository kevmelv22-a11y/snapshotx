/** Who may open a file in the private 'snapshotx-media' bucket (mirrors the storage policy sx_media_read).
 *  Bug fixed 2026-10-28: the policy required `m.expires_at > now()`. In chats set to "Bewaren" (keep) and for messages
 *  saved in chat, expires_at is NULL ("never expires") and `NULL > now()` is not true in SQL, so the OTHER members got
 *  no signed URL and photos, videos and voice notes kept spinning forever. Rule now: NULL = kept = readable.
 *  The fixed policy is in migration 20261028000000_media_read_kept_chats.sql (NOT applied yet). The demo client uses
 *  canReadMedia() for its storage stub so the web demo behaves like the server. No I/O. */

export type MediaMessageRef = { media_path?: string | null; expires_at?: string | null; media_deleted_at?: string | null; unsent_at?: string | null };
export type MediaStoryRef = { media_path?: string | null; owner_id?: string | null; expires_at?: string | null; media_deleted_at?: string | null };

export const MEDIA_LABEL = { gone: 'Niet meer beschikbaar', goneHint: 'Deze media is verlopen of verwijderd' } as const;
export const MEDIA_ERRORS = { gone: 'Deze media is niet meer beschikbaar' } as const;

/** NULL / missing expires_at means "kept" (Bewaren or saved in chat) → never expires. */
export function notExpired(expiresAt: string | null | undefined, now: number): boolean {
  if (expiresAt == null || expiresAt === '') return true;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) ? false : t > now;
}

/** A chat message still grants access to its media. */
export function messageMediaActive(m: MediaMessageRef, now: number, legacyNullExpired = false): boolean {
  if (legacyNullExpired && m.expires_at == null) return false; // pre-fix SQL: NULL > now() is not true
  return !!m.media_path && !m.media_deleted_at && !m.unsent_at && notExpired(m.expires_at, now);
}

/** A story grants access: always to its owner, to others while it is live. */
export function storyMediaActive(s: MediaStoryRef, me: string | null | undefined, now: number): boolean {
  if (!s.media_path || s.media_deleted_at) return false;
  return (!!me && s.owner_id === me) || (s.expires_at != null && notExpired(s.expires_at, now));
}

/** Storage read decision for one path. Own folder (<uid>/…) is always readable. A path that no message or story
 *  references (e.g. a memory) is left to the other rules → readable here. A referenced path is readable while at
 *  least ONE reference is still active (forwarded copies share the original path). */
/** legacyNullExpired = the old (buggy) rule, only for the demo fault switch `?demo_faults=old-media-rule`. */
export function canReadMedia(p: { path: string; me?: string | null; messages: MediaMessageRef[]; stories: MediaStoryRef[]; now: number; legacyNullExpired?: boolean }): boolean {
  if (p.me && p.path.split('/')[0] === p.me) return true;
  const msgs = p.messages.filter(m => m.media_path === p.path);
  const sts = p.stories.filter(s => s.media_path === p.path);
  if (!msgs.length && !sts.length) return true;
  if (msgs.some(m => m.media_deleted_at)) return false;
  return msgs.some(m => messageMediaActive(m, p.now, p.legacyNullExpired)) || sts.some(s => storyMediaActive(s, p.me, p.now));
}
