/** Deep link opened while signed out — reopened right after login. In-memory on purpose. */
type Pending = { kind: 'add'; code: string } | { kind: 'group'; token: string } | null;
let pending: Pending = null;

export function setPendingAdd(code: string | null) {
  pending = code ? { kind: 'add', code } : null;
}
export function peekPendingAdd(): string | null {
  return pending?.kind === 'add' ? pending.code : null;
}

export function setPendingGroupInvite(token: string | null) {
  pending = token ? { kind: 'group', token } : null;
}
export function peekPendingGroupInvite(): string | null {
  return pending?.kind === 'group' ? pending.token : null;
}

/** Where to send a freshly signed-in user who opened a deep link while logged out. */
export function pendingAfterLogin(): { pathname: '/add/[code]'; params: { code: string } } | { pathname: '/g/[token]'; params: { token: string } } | null {
  if (pending?.kind === 'add') return { pathname: '/add/[code]', params: { code: pending.code } };
  if (pending?.kind === 'group') return { pathname: '/g/[token]', params: { token: pending.token } };
  return null;
}
