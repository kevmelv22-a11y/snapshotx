/**
 * Texts for the notice shown when a fresh sign-in is refused by the server-side access check
 * (sx_check_app_access: user/IP/device ban, deletion pending) or when that check fails.
 * Used by hooks/useSession.tsx; the check itself is unchanged.
 */
export type AccessNoticeKind = 'blocked' | 'check_failed';

export function accessNotice(kind: AccessNoticeKind): { title: string; message: string } {
  return kind === 'blocked'
    ? { title: 'Account geblokkeerd', message: 'Je account, IP of apparaat heeft geen toegang tot SnapShot X.' }
    : { title: 'Toegang controleren mislukt', message: 'Probeer het later opnieuw.' };
}

/** Only an interactive sign-in gets a notice; silent session restores/refreshes just sign out. */
export function accessNoticeFor(event: string, failed: boolean, allowed: unknown): AccessNoticeKind | null {
  if (event !== 'SIGNED_IN') return null;
  if (failed) return 'check_failed';
  return allowed === true ? null : 'blocked';
}
