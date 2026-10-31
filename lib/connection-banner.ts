/**
 * "Geen internetverbinding" banner (web): Snapchat Web shows a bar when the browser goes offline and a short
 * "Weer online" when it comes back. Pure state step so node tests can load it; UI in components/web/OfflineBanner.tsx.
 */
export type ConnState = { phase: 'online' | 'offline' | 'back'; since: number };
export const BACK_ONLINE_MS = 3000;
export const CONN_TEXT = {
  offline: 'Geen internetverbinding. Nieuwe berichten en snaps komen binnen zodra je weer online bent.',
  back: 'Weer online',
} as const;

export function connStep(s: ConnState, online: boolean, now: number): ConnState {
  if (!online) return s.phase === 'offline' ? s : { phase: 'offline', since: now };
  if (s.phase === 'offline') return { phase: 'back', since: now };
  if (s.phase === 'back' && now - s.since >= BACK_ONLINE_MS) return { phase: 'online', since: now };
  return s;
}

export function connText(s: ConnState): string | null {
  return s.phase === 'offline' ? CONN_TEXT.offline : s.phase === 'back' ? CONN_TEXT.back : null;
}
