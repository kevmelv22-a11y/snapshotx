import { friendLink } from './friend-code';
/**
 * The signed-in user's own identity (username, display name, score) for the profile, settings and
 * "Mijn SnapShot X-code" screens. Robust against a missing profiles row (live returned 0 rows, which made
 * `.single()` fail with "Cannot coerce the result to a single JSON object") and against unavailable tables.
 * Pure: the Supabase client is passed in, so this file is testable with `npx tsx --test`.
 *
 * Source order: profiles row → sx_ensure_profile() (creates the missing row server-side, migration
 * 20261019120000) → sign-up metadata (username/display_name given at registration) → "user_<8 hex>".
 */
import { dbErrorKind, friendlyError } from './db-errors';

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export type OwnUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
export type ProfileRow = { username?: string | null; display_name?: string | null; activity_score?: number | null };
export type OwnProfile = {
  id: string;
  /** Always set: real username, else the sign-up username, else user_<8 hex of the id>. */
  handle: string;
  /** True only when `handle` is the username stored in profiles (others can find it by search). */
  hasUsername: boolean;
  displayName: string;
  activityScore: number;
  source: 'profile' | 'created' | 'metadata' | 'fallback';
  /** QR payload: by username when stored and scannable, else by user id (scanners look the id up). */
  qrValue: string;
  /** Friendly Dutch problem text when the profile could not be read (screen still renders). */
  notice: string;
};

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function fallbackHandle(userId: string): string {
  return `user_${userId.replace(/-/g, '').slice(0, 8).toLowerCase()}`;
}

export function ownIdentity(user: OwnUser, row: ProfileRow | null | undefined, source: OwnProfile['source'] = 'profile', notice = ''): OwnProfile {
  const meta = user.user_metadata ?? {};
  const stored = clean(row?.username);
  const signup = clean(meta.username).toLowerCase();
  const hasUsername = !!row && stored.length > 0;
  const handle = hasUsername ? stored : USERNAME_RE.test(signup) ? signup : fallbackHandle(user.id);
  const displayName = clean(row?.display_name) || clean(meta.display_name) || clean(user.email).split('@')[0] || handle;
  const effective: OwnProfile['source'] = hasUsername ? source : USERNAME_RE.test(signup) ? 'metadata' : 'fallback';
  return {
    id: user.id, handle, hasUsername, displayName, activityScore: Number(row?.activity_score) || 0, source: effective,
    // Scanners only accept [a-z0-9_]{3,24} usernames; older/odd usernames (e.g. with a dot) use the id form.
    qrValue: friendLink(hasUsername ? handle : null, user.id), notice,
  };
}

export { parseFriendCode, type FriendCode } from './friend-code';

type Res<T> = { data: T | null; error: { message?: string; code?: string } | null };
/** Minimal structural client type (supabase-js and the demo client both fit). */
export type ProfileClient = {
  from: (table: 'profiles') => { select: (cols: string) => { eq: (col: string, v: string) => { maybeSingle: () => PromiseLike<Res<ProfileRow>> } } };
  rpc: (fn: 'sx_ensure_profile') => PromiseLike<Res<ProfileRow[] | ProfileRow>>;
};

export async function loadOwnProfile(client: ProfileClient, user: OwnUser): Promise<OwnProfile> {
  let res = await client.from('profiles').select('username,display_name,activity_score').eq('id', user.id).maybeSingle();
  if (res.error && dbErrorKind(res.error) === 'missing_column') res = await client.from('profiles').select('username,display_name').eq('id', user.id).maybeSingle();
  if (res.error) return ownIdentity(user, null, 'fallback', friendlyError(res.error, 'Je profiel'));
  if (res.data && clean(res.data.username)) return ownIdentity(user, res.data, 'profile');
  // No row (or no username yet): let the server create/complete it. Missing RPC = migration not applied yet.
  try {
    const made = await client.rpc('sx_ensure_profile');
    const row = Array.isArray(made.data) ? made.data[0] : made.data;
    if (!made.error && row) return ownIdentity(user, { ...row, activity_score: res.data?.activity_score ?? row.activity_score }, 'created');
  } catch { /* fall through to the local fallback */ }
  return ownIdentity(user, res.data, 'profile');
}
