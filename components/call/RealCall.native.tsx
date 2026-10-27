import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { mediaDevices, MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';
import { C } from '../../lib/theme';
import { callStatusText, nextCallState, type CallEvent, type CallState } from '../../lib/chat-features';
import { CALL_ICE_SERVERS, RING_TIMEOUT_MS, callSessionTopic, endReasonText, parseSignal, userCallTopic } from '../../lib/call-signal';
import { activeCall, joinBroadcast, sendBroadcast, sendOnce } from '../../lib/call-channel';
import type { RealCallProps } from './RealCall';

type EndReason = Parameters<typeof endReasonText>[0];
type Ice = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

export default function RealCall({ threadId, name, role, callId: givenCallId, peerId: givenPeer }: RealCallProps) {
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<CallState>(role === 'caller' ? 'ringing' : 'connecting');
  const [note, setNote] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null), [now, setNow] = useState(() => Date.now());
  const [local, setLocal] = useState<MediaStream | null>(null), [remote, setRemote] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false), [camOff, setCamOff] = useState(false), [front, setFront] = useState(true);
  const r = useRef<{ pc?: RTCPeerConnection; ch?: RealtimeChannel; local?: MediaStream; pending: Ice[]; ended: boolean; accepted: boolean; timers: ReturnType<typeof setTimeout>[]; end?: (why: EndReason, notify: boolean, navigate?: boolean) => void }>({ pending: [], ended: false, accepted: false, timers: [] });

  const fire = (e: CallEvent) => setState(s => { const n = nextCallState(s, e); if (n === 'active' && s !== 'active') setStartedAt(t => t ?? Date.now()); return n; });

  useEffect(() => {
    if (!me) return;
    const ref: typeof r.current = { pending: [], ended: false, accepted: false, timers: [] };
    r.current = ref;
    const callId = givenCallId || Crypto.randomUUID();
    activeCall.id = callId;
    const end = (why: EndReason, notify: boolean, navigate = true) => {
      if (ref.ended) return;
      ref.ended = true;
      if (notify && ref.ch) void sendBroadcast(ref.ch, 'signal', { type: 'hangup', from: me }).catch(() => {});
      ref.timers.forEach(clearTimeout);
      ref.local?.getTracks().forEach(t => t.stop());
      try { ref.pc?.close(); } catch { /* already closed */ }
      const ch = ref.ch; if (ch) setTimeout(() => void supabase.removeChannel(ch), 300);
      if (activeCall.id === callId) activeCall.id = null;
      setNote(why === 'local' ? '' : endReasonText(why));
      fire('hangup');
      if (navigate) ref.timers.push(setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/chats')), 1500));
    };
    ref.end = end;
    const send = (payload: object) => ref.ch ? sendBroadcast(ref.ch, 'signal', { ...payload, from: me }) : Promise.resolve();
    const addIce = async (c: Ice) => { await ref.pc?.addIceCandidate(new RTCIceCandidate(c)); };
    const flushIce = async () => { const list = ref.pending.splice(0); for (const c of list) await addIce(c).catch(() => {}); };

    (async () => {
      try {
        let peer = givenPeer;
        if (role === 'caller') {
          const { data, error } = await supabase.from('sx_members').select('user_id').eq('thread_id', threadId).neq('user_id', me);
          if (error) throw error;
          if (!data || data.length !== 1) throw new Error(data && data.length > 1 ? 'Groepsgesprekken kunnen nog niet: bel één vriend tegelijk.' : 'Geen gesprekspartner gevonden.');
          peer = data[0].user_id as string;
        }
        if (!peer) throw new Error('Geen gesprekspartner gevonden.');
        const stream = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: 640, height: 480, frameRate: 30 } });
        if (ref.ended) { stream.getTracks().forEach(t => t.stop()); return; }
        ref.local = stream; setLocal(stream);
        const pc = new RTCPeerConnection({ iceServers: CALL_ICE_SERVERS });
        ref.pc = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pc.addEventListener('icecandidate', (e: { candidate: Ice | null }) => { if (e.candidate) void send({ type: 'ice', candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid ?? null, sdpMLineIndex: e.candidate.sdpMLineIndex ?? null } }).catch(() => {}); });
        pc.addEventListener('track', (e: { streams?: MediaStream[] }) => { const s = e.streams?.[0]; if (s) setRemote(s); });
        pc.addEventListener('connectionstatechange', () => {
          const st = pc.connectionState;
          if (st === 'connected') fire('connected');
          else if (st === 'failed') end('failed', true);
        });
        ref.ch = await joinBroadcast(callSessionTopic(callId), async (_event, payload) => {
          const sig = parseSignal(payload, me);
          if (!sig || ref.ended || sig.from !== peer) return;
          try {
            if (sig.type === 'accept' && role === 'caller' && !ref.accepted) {
              ref.accepted = true; fire('answer');
              const offer = await pc.createOffer({});
              await pc.setLocalDescription(offer);
              await send({ type: 'offer', sdp: offer.sdp });
            } else if (sig.type === 'offer' && role === 'callee') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sig.sdp }));
              await flushIce();
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await send({ type: 'answer', sdp: answer.sdp });
            } else if (sig.type === 'answer' && role === 'caller') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sig.sdp }));
              await flushIce();
            } else if (sig.type === 'ice') {
              if (pc.remoteDescription) await addIce(sig.candidate); else ref.pending.push(sig.candidate);
            } else if (sig.type === 'decline') end('declined', false);
            else if (sig.type === 'busy') end('busy', false);
            else if (sig.type === 'hangup') end('hangup', false);
          } catch { end('failed', true); }
        });
        if (ref.ended) return;
        if (role === 'caller') {
          const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', me).maybeSingle();
          const invite = { callId, from: me, fromName: (prof as { display_name?: string } | null)?.display_name || 'Iemand', threadId, video: true };
          const ring = () => { if (!ref.accepted && !ref.ended) void sendOnce(userCallTopic(peer!), 'invite', { ...invite, at: Date.now() }).catch(() => {}); };
          ring();
          for (let ms = 4000; ms < RING_TIMEOUT_MS; ms += 4000) ref.timers.push(setTimeout(ring, ms));
          ref.timers.push(setTimeout(() => { if (!ref.accepted) end('timeout', true); }, RING_TIMEOUT_MS));
        } else {
          await send({ type: 'accept' });
          ref.timers.push(setTimeout(() => { if (pc.connectionState !== 'connected' && !ref.ended) end('failed', true); }, 30000));
        }
      } catch (e) {
        setNote(e instanceof Error && /permission|denied|notallowed/i.test(e.message) ? 'Geef SnapShot X toegang tot camera en microfoon in Instellingen.' : e instanceof Error ? e.message : 'Bellen mislukt.');
        end('failed', false);
      }
    })();
    return () => end('local', true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const toggleMute = () => { const v = !muted; local?.getAudioTracks().forEach(t => { t.enabled = !v; }); setMuted(v); };
  const toggleCam = () => { const v = !camOff; local?.getVideoTracks().forEach(t => { t.enabled = !v; }); setCamOff(v); };
  const flip = () => {
    const t = local?.getVideoTracks()[0]; if (!t) return;
    const next = !front;
    t.applyConstraints({ facingMode: next ? 'user' : 'environment' }).catch(() => (t as unknown as { _switchCamera: () => void })._switchCamera());
    setFront(next);
  };
  const hangup = () => r.current.end?.('local', true);
  const active = state === 'active';
  const status = state === 'ended' ? (note || callStatusText(state, 0)) : callStatusText(state, startedAt ? now - startedAt : 0);

  return <View style={s.root} testID="call-screen">
    <View style={[StyleSheet.absoluteFill, s.remote]}>
      {remote && active
        ? <RTCView streamURL={remote.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
        : <View style={s.avatar}><Text style={s.avatarText}>{String(name).slice(0, 1).toUpperCase()}</Text></View>}
    </View>
    <View style={[s.top, { paddingTop: insets.top + 16 }]}>
      <Text style={s.name}>{name}</Text>
      <Text style={s.status}>{status}</Text>
      {!!note && state !== 'ended' && <Text style={s.note}>{note}</Text>}
    </View>
    <View style={[s.self, { top: insets.top + 120 }]}>
      {local && !camOff ? <RTCView streamURL={local.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={front} zOrder={1} /> : <Text style={s.selfOff}>Camera uit</Text>}
    </View>
    <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
      <Ctl icon={muted ? '🔇' : '🎙'} label={muted ? 'Dempen uit' : 'Dempen'} on={muted} onPress={toggleMute} />
      <Ctl icon={camOff ? '🚫' : '📹'} label={camOff ? 'Camera aan' : 'Camera uit'} on={camOff} onPress={toggleCam} />
      <Ctl icon="🔄" label="Camera omdraaien" onPress={flip} />
      <Pressable onPress={hangup} accessibilityLabel="Ophangen" style={[s.ctl, s.hang]}><Text style={s.ctlIcon}>📞</Text></Pressable>
    </View>
  </View>;
}

function Ctl({ icon, label, on, onPress }: { icon: string; label: string; on?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} style={[s.ctl, on && { backgroundColor: C.text }]}><Text style={s.ctlIcon}>{icon}</Text></Pressable>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' }, remote: { backgroundColor: '#1b1430', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.text, fontSize: 60, fontWeight: '800' },
  top: { alignItems: 'center', gap: 4 }, name: { color: C.text, fontSize: 26, fontWeight: '800' }, status: { color: C.text, fontSize: 16 }, note: { color: C.yellow, fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  self: { position: 'absolute', right: 16, width: 100, height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: '#333a', borderWidth: 2, borderColor: '#fff5', alignItems: 'center', justifyContent: 'center' }, selfOff: { color: C.text, fontSize: 12 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 20, backgroundColor: '#0008' },
  ctl: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff2a', alignItems: 'center', justifyContent: 'center' }, hang: { backgroundColor: '#ff3b30', transform: [{ rotate: '135deg' }] }, ctlIcon: { fontSize: 24 },
});
