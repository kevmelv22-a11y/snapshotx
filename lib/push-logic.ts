/** Pure push-notification helpers (no expo imports) shared by components/PushSync.tsx, app/notifications.tsx and Uitloggen.
 *  Server pushes (supabase/functions/push-message) carry `{ thread_id, message_id }`; local ones (lib/backend/push.ts
 *  buildPayload) carry `{ kind, route }`. Neither ever contains chat text. */
import { isUuid } from './chat-ids';

const normalizeUuid = (v: unknown): string | null => (isUuid(v) ? v.trim().toLowerCase() : null);

export type PushOs = 'ios' | 'android' | 'web' | string;
type Data = Record<string, unknown> | null | undefined;
const asData = (d: unknown): Data => (d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : null);

/** Chat thread a push belongs to (server `thread_id` or a local `/chat/<uuid>` route), or null. */
export function pushThreadId(data: unknown): string | null {
  const d = asData(data);
  if (!d) return null;
  const direct = normalizeUuid(d.thread_id);
  if (direct) return direct;
  const route = typeof d.route === 'string' ? d.route : '';
  const m = /^\/chat\/([^/?#]+)$/.exec(route);
  return m ? normalizeUuid(m[1]) : null;
}

/** Screen to open when the user taps a notification. Only known, safe in-app routes; anything else → null (stay put). */
export function pushRoute(data: unknown): string | null {
  const thread = pushThreadId(data);
  if (thread) return `/chat/${thread}`;
  const d = asData(data);
  if (!d) return null;
  if (d.kind === 'friend_request' || d.route === '/friends' || d.route === '/(tabs)/friends') return '/(tabs)/friends';
  return null;
}

/** Foreground behaviour (app open): Snapchat shows a banner, except for the chat you are looking at right now. */
export function showInForeground(data: unknown, openThreadId: string | null | undefined): boolean {
  const thread = pushThreadId(data);
  const open = normalizeUuid(openThreadId);
  return !(thread && open && thread === open);
}

/** Dutch text when the OS blocks notifications, with the right settings path per platform. */
export function pushDeniedText(os: PushOs): string {
  if (os === 'android') return 'Meldingen zijn uitgeschakeld voor Snapshot X. Zet ze aan via Instellingen › Apps › SnapShot X › Meldingen op je telefoon.';
  return 'Meldingen zijn niet toegestaan op dit toestel. Zet ze aan via Instellingen › SnapShot X › Meldingen op je iPhone.';
}

/** Silent refresh at sign-in: only when the OS permission is already granted (never prompt on launch) and the user's
 *  master switch (Meldingen inschakelen) is not off. Web and demo builds never register. */
export function shouldAutoRegister(o: { os: PushOs; demo: boolean; permission: 'granted' | 'denied' | 'undetermined' | string; masterOn: boolean | null | undefined }): boolean {
  return o.os !== 'web' && !o.demo && o.permission === 'granted' && o.masterOn !== false;
}

/** Row written to public.sx_push_tokens (live columns: user_id, token, updated_at; PK user_id+token). */
export function pushTokenRow(uid: string, token: string, now = Date.now()) {
  return { user_id: uid, token, updated_at: new Date(now).toISOString() };
}

/** Uitloggen on this device: forget this device's push token first (else the next person on this phone gets the
 *  previous account's pushes), then end only THIS session (scope local — other devices stay signed in).
 *  A failing token cleanup never blocks signing out. */
export async function signOutThisDevice(deps: { forgetToken: () => Promise<void>; signOut: (o: { scope: 'local' }) => Promise<unknown> }): Promise<{ tokenRemoved: boolean }> {
  let tokenRemoved = true;
  try { await deps.forgetToken(); } catch { tokenRemoved = false; }
  await deps.signOut({ scope: 'local' });
  return { tokenRemoved };
}
