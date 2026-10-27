/** 1:1 call signaling over Supabase Realtime broadcast (no server tables needed).
 *  Invites go to the callee's personal topic; SDP/ICE/accept/decline/hangup go over a per-call topic. */
export const CALL_ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
export const RING_TIMEOUT_MS = 45000;

export const userCallTopic = (userId: string) => `sx-call-user:${userId}`;
export const callSessionTopic = (callId: string) => `sx-call:${callId}`;

export type CallInvite = { callId: string; from: string; fromName: string; threadId: string; video: boolean; at: number };
export type CallSignal =
  | { type: 'accept'; from: string }
  | { type: 'decline'; from: string }
  | { type: 'busy'; from: string }
  | { type: 'hangup'; from: string }
  | { type: 'offer'; from: string; sdp: string }
  | { type: 'answer'; from: string; sdp: string }
  | { type: 'ice'; from: string; candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } };

const UUIDISH = /^[0-9a-f-]{8,64}$/i;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validates an incoming invite payload; stale invites (older than the ring timeout) are dropped. */
export function parseInvite(p: unknown, now = Date.now()): CallInvite | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (!isStr(o.callId) || !UUIDISH.test(o.callId) || !isStr(o.from) || !isStr(o.threadId)) return null;
  const at = typeof o.at === 'number' ? o.at : 0;
  if (now - at > RING_TIMEOUT_MS || at - now > 60000) return null;
  return { callId: o.callId, from: o.from, threadId: o.threadId, fromName: isStr(o.fromName) ? o.fromName.slice(0, 60) : 'Iemand', video: o.video !== false, at };
}

/** Validates a per-call signal; signals from ourselves or of unknown shape are ignored. */
export function parseSignal(p: unknown, me: string): CallSignal | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (!isStr(o.from) || o.from === me) return null;
  switch (o.type) {
    case 'accept': case 'decline': case 'busy': case 'hangup': return { type: o.type, from: o.from };
    case 'offer': case 'answer': return isStr(o.sdp) ? { type: o.type, from: o.from, sdp: o.sdp } : null;
    case 'ice': {
      const c = o.candidate as Record<string, unknown> | undefined;
      if (!c || typeof c.candidate !== 'string') return null;
      return { type: 'ice', from: o.from, candidate: { candidate: c.candidate, sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid : null, sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : null } };
    }
    default: return null;
  }
}

/** Dutch end reason shown before the call screen closes. */
export function endReasonText(r: 'declined' | 'busy' | 'hangup' | 'timeout' | 'failed' | 'local'): string {
  return r === 'declined' ? 'Gesprek geweigerd' : r === 'busy' ? 'In gesprek' : r === 'timeout' ? 'Geen antwoord' : r === 'failed' ? 'Verbinding mislukt' : 'Gesprek beëindigd';
}
