/**
 * SnapShot X friend codes (QR / Snapcode / share links). Pure — no React Native imports, so node tests can load it.
 * The QR encodes a normal https link so ANY phone camera can open it (web or, with the app installed, the app):
 *   https://snapshot-x.nl/add/<username>   or   https://snapshot-x.nl/add/<user-uuid> (no usable username yet)
 * The in-app scanner and deep links also accept the older/app forms:
 *   snapshotx://add/<code>, snapshotx://friends?u=<username>, snapshotx://friends?id=<uuid>, /add/<code>
 */
export const FRIEND_LINK_HOST = 'snapshot-x.nl';
/** Usernames as stored (letters, digits, _ - and inner dots, e.g. kevraz0r or kv.savage). */
export const USERNAME_CODE_RE = /^(?![.-])(?!.*\.\.)[a-z0-9._-]{3,30}(?<![.-])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FriendCode = { kind: 'username'; value: string } | { kind: 'id'; value: string } | null;

export function friendLink(handle: string | null | undefined, userId: string): string {
  const h = (handle ?? '').trim().toLowerCase();
  return `https://${FRIEND_LINK_HOST}/add/${USERNAME_CODE_RE.test(h) ? h : userId.toLowerCase()}`;
}

/** One path segment ("kevin", "@Kevin", a uuid) → code. */
export function parseCodeSegment(segment: string | null | undefined): FriendCode {
  let v = (segment ?? '').trim();
  try { v = decodeURIComponent(v); } catch { /* keep raw */ }
  v = v.replace(/^@/, '').trim();
  if (UUID_RE.test(v)) return { kind: 'id', value: v.toLowerCase() };
  const u = v.toLowerCase();
  return USERNAME_CODE_RE.test(u) ? { kind: 'username', value: u } : null;
}

export function parseFriendCode(data: string | null | undefined): FriendCode {
  const raw = (data ?? '').trim();
  if (!raw || raw.length > 300) return null;
  const legacy = /^snapshotx:\/\/\/?friends\/?\?(u|id)=([^&#]+)$/i.exec(raw);
  if (legacy) {
    const c = parseCodeSegment(legacy[2]);
    return c && (legacy[1].toLowerCase() === 'u' ? c.kind === 'username' : c.kind === 'id') ? c : null;
  }
  const app = /^snapshotx:\/\/\/?add\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(raw);
  if (app) return parseCodeSegment(app[1]);
  const web = /^(?:https?:\/\/)?(?:www\.)?snapshot-x\.nl\/add\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(raw);
  if (web) return parseCodeSegment(web[1]);
  const path = /^\/add\/([^/?#]+)\/?$/.exec(raw);
  if (path) return parseCodeSegment(path[1]);
  return null;
}

/** Server answer of sx_request_friend → Dutch status line. */
export function requestResultText(result: string | null | undefined, name: string): string {
  if (result === 'accepted') return `Jij en ${name} zijn nu vrienden 🎉`;
  if (result === 'friends') return `Je bent al bevriend met ${name}.`;
  if (result === 'pending') return `Vriendschapsverzoek naar ${name} verstuurd.`;
  return 'Er ging iets mis. Probeer het opnieuw.';
}
