/** Browser (web) 1:1 call: real WebRTC via the browser's RTCPeerConnection + getUserMedia, signaled over
 *  Supabase Realtime with the same protocol as the iPhone app (RealCall.native.tsx), so web ↔ app calls work. */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';
import { C } from '../../lib/theme';
import { callStatusText, nextCallState, type CallEvent, type CallState } from '../../lib/chat-features';
import { startCall, type PeerLike } from '../../lib/call-engine';
import { activeCall, joinBroadcast, sendBroadcast, sendOnce } from '../../lib/call-channel';

export type RealCallProps = { threadId: string; name: string; role: 'caller' | 'callee'; callId?: string; peerId?: string; audioOnly?: boolean };

type WebStream = { getTracks(): { stop(): void; enabled: boolean; kind: string }[]; getAudioTracks(): { enabled: boolean }[]; getVideoTracks(): { enabled: boolean }[] };
type Nav = { mediaDevices?: { getUserMedia(c: object): Promise<WebStream> } };

/** Attaches a MediaStream to a <video>/<audio> element. */
function useStreamEl<T extends HTMLMediaElement>(stream: unknown) {
  const ref = useRef<T | null>(null);
  useEffect(() => { const el = ref.current; if (el && el.srcObject !== stream) { el.srcObject = (stream as MediaStream) ?? null; void el.play?.().catch(() => {}); } }, [stream]);
  return ref;
}

export default function RealCall({ threadId, name, role, callId: givenCallId, peerId: givenPeer, audioOnly }: RealCallProps) {
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const video = !audioOnly;
  const [state, setState] = useState<CallState>(role === 'caller' ? 'ringing' : 'connecting');
  const [note, setNote] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null), [now, setNow] = useState(() => Date.now());
  const [local, setLocal] = useState<WebStream | null>(null), [remote, setRemote] = useState<unknown>(null);
  const [muted, setMuted] = useState(false), [camOff, setCamOff] = useState(false);
  const hang = useRef<() => void>(() => {});
  const fire = (e: CallEvent) => setState(s => { const n = nextCallState(s, e); if (n === 'active' && s !== 'active') setStartedAt(t => t ?? Date.now()); return n; });
  const remoteVideo = useStreamEl<HTMLVideoElement>(remote), remoteAudio = useStreamEl<HTMLAudioElement>(remote), selfVideo = useStreamEl<HTMLVideoElement>(local);

  useEffect(() => {
    if (!me) return;
    let gone = false, navTimer: ReturnType<typeof setTimeout> | undefined, handle: ReturnType<typeof startCall> | null = null;
    const callId = givenCallId || Crypto.randomUUID();
    activeCall.id = callId;
    const finish = (n: string, navigate: boolean) => {
      if (activeCall.id === callId) activeCall.id = null;
      if (gone) return;
      setNote(n); fire('hangup');
      if (navigate) navTimer = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/chats')), 1500);
    };
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
        const nav = (globalThis as { navigator?: Nav }).navigator;
        const RTC = (globalThis as { RTCPeerConnection?: new (c: object) => PeerLike }).RTCPeerConnection;
        if (!nav?.mediaDevices?.getUserMedia || !RTC) throw Object.assign(new Error('no media'), { name: 'NoMediaDevices' });
        let fromName = 'Iemand';
        if (role === 'caller') {
          const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', me).maybeSingle();
          fromName = (prof as { display_name?: string } | null)?.display_name || fromName;
        }
        if (gone) return;
        handle = startCall<WebStream>({
          me, peer, role, callId, threadId, fromName, video,
          getUserMedia: c => nav.mediaDevices!.getUserMedia(c),
          createPeer: cfg => new RTC(cfg),
          join: async (topic, onMessage) => { const ch = await joinBroadcast(topic, onMessage); return { send: (e, p) => sendBroadcast(ch, e, p), leave: () => { void supabase.removeChannel(ch); } }; },
          sendOnce,
          onLocal: s => { if (!gone) setLocal(s); },
          onRemote: s => { if (!gone) setRemote(s); },
          onAnswered: () => { if (!gone) fire('answer'); },
          onConnected: () => { if (!gone) fire('connected'); },
          onEnd: (why, n) => finish(n, why !== 'local' || !gone),
        });
        hang.current = handle.hangup;
      } catch (e) {
        finish(e instanceof Error && e.name === 'NoMediaDevices' ? 'Bellen in de browser werkt alleen via een beveiligde verbinding (https) in een recente browser.' : e instanceof Error ? e.message : 'Bellen mislukt.', true);
      }
    })();
    return () => { gone = true; handle?.hangup(); if (navTimer) clearTimeout(navTimer); if (activeCall.id === callId) activeCall.id = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const toggleMute = () => { const v = !muted; local?.getAudioTracks().forEach(t => { t.enabled = !v; }); setMuted(v); };
  const toggleCam = () => { const v = !camOff; local?.getVideoTracks().forEach(t => { t.enabled = !v; }); setCamOff(v); };
  const active = state === 'active';
  const status = state === 'ended' ? (note || callStatusText(state, 0)) : callStatusText(state, startedAt ? now - startedAt : 0);
  const showRemoteVideo = video && !!remote && active;

  return <View style={s.root} testID="call-screen">
    <View style={[StyleSheet.absoluteFill, s.remote]}>
      {video
        ? <video ref={remoteVideo} autoPlay playsInline data-testid="call-remote-video" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: showRemoteVideo ? 'block' : 'none', background: '#000' }} />
        : <audio ref={remoteAudio} autoPlay data-testid="call-remote-audio" />}
      {!showRemoteVideo && <View style={s.avatar}><Text style={s.avatarText}>{String(name).slice(0, 1).toUpperCase()}</Text></View>}
    </View>
    <View style={s.top}>
      <Text style={s.name}>{name}</Text>
      <Text style={s.status} testID="call-status">{status}</Text>
      <Text style={s.kind}>{video ? 'Videogesprek' : 'Spraakgesprek'} · in je browser</Text>
      {!!note && state !== 'ended' && <Text style={s.note}>{note}</Text>}
    </View>
    {video && <View style={s.self}>
      <video ref={selfVideo} autoPlay playsInline muted data-testid="call-self-video" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: local && !camOff ? 'block' : 'none' }} />
      {(!local || camOff) && <Text style={s.selfOff}>{local ? 'Camera uit' : 'Camera starten…'}</Text>}
    </View>}
    <View style={s.controls}>
      <Ctl icon={muted ? '🔇' : '🎙'} label={muted ? 'Microfoon aan' : 'Dempen'} on={muted} onPress={toggleMute} />
      {video && <Ctl icon={camOff ? '🚫' : '📹'} label={camOff ? 'Camera aan' : 'Camera uit'} on={camOff} onPress={toggleCam} />}
      <Pressable onPress={() => hang.current()} accessibilityLabel="Ophangen" testID="call-hangup" style={[s.ctl, s.hang]}><Text style={s.ctlIcon}>📞</Text></Pressable>
    </View>
  </View>;
}

function Ctl({ icon, label, on, onPress }: { icon: string; label: string; on?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} style={[s.ctl, on && { backgroundColor: C.text }]}><Text style={s.ctlIcon}>{icon}</Text></Pressable>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' }, remote: { backgroundColor: '#1b1430', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.text, fontSize: 60, fontWeight: '800' },
  top: { alignItems: 'center', gap: 4, paddingTop: 28 }, name: { color: C.text, fontSize: 26, fontWeight: '800' }, status: { color: C.text, fontSize: 16 },
  kind: { color: C.muted, fontSize: 12 }, note: { color: C.yellow, fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  self: { position: 'absolute', right: 20, top: 120, width: 200, height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: '#333a', borderWidth: 2, borderColor: '#fff5', alignItems: 'center', justifyContent: 'center' }, selfOff: { color: C.text, fontSize: 12 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 24, backgroundColor: '#0008' },
  ctl: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff2a', alignItems: 'center', justifyContent: 'center' }, hang: { backgroundColor: '#ff3b30', transform: [{ rotate: '135deg' }] }, ctlIcon: { fontSize: 24 },
});
