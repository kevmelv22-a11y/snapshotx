/** Platform-neutral 1:1 call engine (signaling + WebRTC negotiation) used by the browser call screen.
 *  It talks to WebRTC and Realtime only through the injected `deps`, so it runs in tests with fakes.
 *  The protocol is the same as components/call/RealCall.native.tsx, so web ↔ iPhone calls interoperate:
 *  caller rings the callee's user topic → callee sends `accept` → caller sends `offer` → callee `answer` → ICE. */
import { CALL_ICE_SERVERS, RING_TIMEOUT_MS, callSessionTopic, endReasonText, parseSignal, userCallTopic } from './call-signal';

export type EndReason = Parameters<typeof endReasonText>[0];
export type Ice = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
export type Sdp = { type: 'offer' | 'answer'; sdp?: string };

/** Minimal subset of RTCPeerConnection that the engine uses. */
export interface PeerLike {
  connectionState: string;
  remoteDescription: unknown;
  addTrack(track: unknown, stream: unknown): unknown;
  createOffer(): Promise<Sdp>;
  createAnswer(): Promise<Sdp>;
  setLocalDescription(d: Sdp): Promise<void>;
  setRemoteDescription(d: Sdp): Promise<void>;
  addIceCandidate(c: Ice): Promise<void>;
  close(): void;
  onicecandidate: ((e: { candidate: Ice | null }) => void) | null;
  ontrack: ((e: { streams?: readonly unknown[] }) => void) | null;
  onconnectionstatechange: (() => void) | null;
}
export interface StreamLike { getTracks(): { stop(): void; kind?: string }[] }
export interface Channel { send(event: string, payload: object): Promise<void>; leave(): void }

export type CallDeps<S extends StreamLike> = {
  me: string; peer: string; role: 'caller' | 'callee'; callId: string; threadId: string; fromName: string; video: boolean;
  getUserMedia(c: { audio: boolean; video: boolean | object }): Promise<S>;
  createPeer(cfg: { iceServers: typeof CALL_ICE_SERVERS }): PeerLike;
  join(topic: string, onMessage: (event: string, payload: unknown) => void): Promise<Channel>;
  sendOnce(topic: string, event: string, payload: object): Promise<void>;
  onLocal?(s: S): void; onRemote?(s: unknown): void;
  onAnswered?(): void; onConnected?(): void;
  onEnd(reason: EndReason, note: string): void;
  now?(): number;
  setTimer?(fn: () => void, ms: number): unknown; clearTimer?(t: unknown): void;
  ringEveryMs?: number; connectTimeoutMs?: number;
};

/** Dutch text for a getUserMedia / start-up failure in the browser. */
export function mediaErrorText(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? '', msg = e instanceof Error ? e.message : String(e ?? '');
  if (/NotAllowed|Permission|denied|Security/i.test(name + ' ' + msg)) return 'Geef je browser toegang tot camera en microfoon (slotje in de adresbalk) en probeer opnieuw.';
  if (/NotFound|DevicesNotFound|Overconstrained/i.test(name)) return 'Geen camera of microfoon gevonden.';
  if (/NotReadable|TrackStart/i.test(name)) return 'Je camera of microfoon wordt al door een andere app gebruikt.';
  if (/NoMedia/i.test(name)) return 'Bellen in de browser werkt alleen via een beveiligde verbinding (https) in een recente browser.';
  return msg || 'Bellen mislukt.';
}

/** Starts a call. Returns `hangup()` (local end; notifies the peer). Safe to call more than once. */
export function startCall<S extends StreamLike>(d: CallDeps<S>): { hangup: () => void; ended: () => boolean } {
  const setT = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms)), clrT = d.clearTimer ?? (t => clearTimeout(t as ReturnType<typeof setTimeout>));
  const now = d.now ?? Date.now;
  const timers: unknown[] = [];
  const pending: Ice[] = [];
  let pc: PeerLike | null = null, ch: Channel | null = null, local: S | null = null, ended = false, accepted = false, answered = false;

  const end = (why: EndReason, notify: boolean, note?: string) => {
    if (ended) return;
    ended = true;
    if (notify && ch) void ch.send('signal', { type: 'hangup', from: d.me }).catch(() => {});
    timers.forEach(clrT);
    local?.getTracks().forEach(t => t.stop());
    try { pc?.close(); } catch { /* already closed */ }
    const c = ch; if (c) setT(() => c.leave(), 300);
    d.onEnd(why, note ?? (why === 'local' ? '' : endReasonText(why)));
  };
  const send = (payload: object) => ch ? ch.send('signal', { ...payload, from: d.me }) : Promise.resolve();
  const flushIce = async () => { for (const c of pending.splice(0)) await pc?.addIceCandidate(c).catch(() => {}); };

  (async () => {
    try {
      const stream = await d.getUserMedia({ audio: true, video: d.video ? { facingMode: 'user', width: 640, height: 480 } : false });
      if (ended) { stream.getTracks().forEach(t => t.stop()); return; }
      local = stream; d.onLocal?.(stream);
      const p = d.createPeer({ iceServers: CALL_ICE_SERVERS });
      pc = p;
      stream.getTracks().forEach(t => p.addTrack(t, stream));
      p.onicecandidate = e => { if (e.candidate) void send({ type: 'ice', candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid ?? null, sdpMLineIndex: e.candidate.sdpMLineIndex ?? null } }).catch(() => {}); };
      p.ontrack = e => { const s = e.streams?.[0]; if (s) d.onRemote?.(s); };
      p.onconnectionstatechange = () => {
        if (p.connectionState === 'connected') d.onConnected?.();
        else if (p.connectionState === 'failed') end('failed', true);
      };
      ch = await d.join(callSessionTopic(d.callId), (_event, payload) => { void onSignal(payload); });
      if (ended) { ch.leave(); return; }
      async function onSignal(payload: unknown) {
        const sig = parseSignal(payload, d.me);
        if (!sig || ended || sig.from !== d.peer) return;
        try {
          if (sig.type === 'accept' && d.role === 'caller' && !accepted) {
            accepted = true; d.onAnswered?.();
            const offer = await p.createOffer();
            await p.setLocalDescription(offer);
            await send({ type: 'offer', sdp: offer.sdp });
          } else if (sig.type === 'offer' && d.role === 'callee' && !answered) {
            answered = true;
            await p.setRemoteDescription({ type: 'offer', sdp: sig.sdp });
            await flushIce();
            const answer = await p.createAnswer();
            await p.setLocalDescription(answer);
            await send({ type: 'answer', sdp: answer.sdp });
          } else if (sig.type === 'answer' && d.role === 'caller') {
            await p.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
            await flushIce();
          } else if (sig.type === 'ice') {
            if (p.remoteDescription) await p.addIceCandidate(sig.candidate); else pending.push(sig.candidate);
          } else if (sig.type === 'decline') end('declined', false);
          else if (sig.type === 'busy') end('busy', false);
          else if (sig.type === 'hangup') end('hangup', false);
        } catch { end('failed', true); }
      }
      if (d.role === 'caller') {
        const invite = { callId: d.callId, from: d.me, fromName: d.fromName || 'Iemand', threadId: d.threadId, video: d.video };
        const ring = () => { if (!accepted && !ended) void d.sendOnce(userCallTopic(d.peer), 'invite', { ...invite, at: now() }).catch(() => {}); };
        ring();
        const every = d.ringEveryMs ?? 4000;
        for (let ms = every; ms < RING_TIMEOUT_MS; ms += every) timers.push(setT(ring, ms));
        timers.push(setT(() => { if (!accepted) end('timeout', true); }, RING_TIMEOUT_MS));
      } else {
        await send({ type: 'accept' });
        timers.push(setT(() => { if (pc?.connectionState !== 'connected' && !ended) end('failed', true); }, d.connectTimeoutMs ?? 30000));
      }
    } catch (e) {
      end('failed', false, mediaErrorText(e));
    }
  })();

  return { hangup: () => end('local', true), ended: () => ended };
}
