/** Name shown for another person: their display name, else their @username — never a numeric/uuid code or a blank
 *  "Vriend" (Kevin: usernames everywhere instead of IDs). Pure, shared by stories, Uitgelicht, profile, chat list, forward. */
export const PROFILE_NAME_COLUMNS = 'id,display_name,username';
type P = { display_name?: string | null; username?: string | null } | null | undefined;
const USERNAME_RE = /^[a-z0-9._-]{2,30}$/i;
export function profileName(p: P, fallback = 'Snapshot X-gebruiker'): string {
  const name = (p?.display_name ?? '').trim();
  if (name) return name;
  const u = (p?.username ?? '').trim().replace(/^@/, '');
  return USERNAME_RE.test(u) ? `@${u.toLowerCase()}` : fallback;
}
/** id → shown name for a profiles query result. */
export function profileNames(rows: readonly ({ id: string } & NonNullable<P>)[] | null | undefined): Record<string, string> {
  return Object.fromEntries((rows ?? []).map(r => [r.id, profileName(r)]));
}
