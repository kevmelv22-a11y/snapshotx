import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { router } from 'expo-router';
import { supabase, DEMO_MODE } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';
import { C } from '../../lib/theme';
import { RING_TIMEOUT_MS, callSessionTopic, parseInvite, parseSignal, userCallTopic, type CallInvite } from '../../lib/call-signal';
import { activeCall, joinBroadcast, sendOnce } from '../../lib/call-channel';

/** Listens on the signed-in user's call topic and shows an in-app incoming-call sheet (no CallKit).
 *  Same component on iPhone and in the browser (web has no push/CallKit, so this Realtime sheet is how web gets rung). */
export default function IncomingCall() {
  const { session } = useSession();
  const me = session?.user.id;
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!me || DEMO_MODE) return;
    let gone = false;
    const ch = supabase.channel(userCallTopic(me), { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'invite' }, (m: { payload: unknown }) => {
      const inv = parseInvite(m.payload);
      if (!inv || gone || seen.current.has(inv.callId)) return;
      seen.current.add(inv.callId);
      if (activeCall.id) { void sendOnce(callSessionTopic(inv.callId), 'signal', { type: 'busy', from: me }).catch(() => {}); return; }
      setInvite(inv);
    }).subscribe();
    return () => { gone = true; void supabase.removeChannel(ch); };
  }, [me]);

  // While ringing: vibrate, stop on caller hang-up or timeout.
  useEffect(() => {
    if (!invite || !me) return;
    const web = Platform.OS === 'web';
    const stopRing = web ? startWebRing(invite.fromName) : (Vibration.vibrate([0, 800, 1200], true), () => Vibration.cancel());
    let ch: Awaited<ReturnType<typeof joinBroadcast>> | null = null, gone = false;
    joinBroadcast(callSessionTopic(invite.callId), (_e, p) => { const s = parseSignal(p, me); if (s?.type === 'hangup' && s.from === invite.from) setInvite(null); })
      .then(c => { if (gone) void supabase.removeChannel(c); else ch = c; }).catch(() => {});
    const t = setTimeout(() => setInvite(null), Math.max(1000, RING_TIMEOUT_MS - (Date.now() - invite.at)));
    return () => { gone = true; stopRing(); clearTimeout(t); if (ch) void supabase.removeChannel(ch); };
  }, [invite, me]);

  if (!invite || !me) return null;
  const accept = () => { const inv = invite; setInvite(null); router.push({ pathname: '/call/[id]', params: { id: inv.threadId, name: inv.fromName, role: 'callee', callId: inv.callId, peer: inv.from, ...(inv.video ? {} : { audio: '1' }) } }); };
  const decline = () => { const inv = invite; setInvite(null); void sendOnce(callSessionTopic(inv.callId), 'signal', { type: 'decline', from: me }).catch(() => {}); };
  return <Modal visible transparent animationType="slide" onRequestClose={decline}>
    <View style={s.wrap}><View style={s.card} testID="incoming-call">
      <View style={s.avatar}><Text style={s.avatarText}>{invite.fromName.slice(0, 1).toUpperCase()}</Text></View>
      <Text style={s.name}>{invite.fromName}</Text>
      <Text style={s.sub}>{invite.video ? 'belt je via video…' : 'belt je…'}</Text>
      <View style={s.row}>
        <Pressable onPress={decline} accessibilityLabel="Weigeren" style={[s.btn, { backgroundColor: '#ff3b30' }]}><Text style={s.btnText}>Weigeren</Text></Pressable>
        <Pressable onPress={accept} accessibilityLabel="Opnemen" style={[s.btn, { backgroundColor: '#34c759' }]}><Text style={s.btnText}>Opnemen</Text></Pressable>
      </View>
    </View></View>
  </Modal>;
}
/** Browser: soft two-tone ring via Web Audio + blinking tab title ("📞 Naam belt…"). Returns a stop function. */
function startWebRing(fromName: string): () => void {
  const doc = (globalThis as { document?: { title: string } }).document;
  const title = doc?.title ?? '';
  let ctx: { currentTime: number; destination: unknown; createOscillator(): any; createGain(): any; close(): Promise<void> } | null = null;
  try { const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext; if (AC) ctx = new AC(); } catch { ctx = null; }
  const beep = () => {
    if (!ctx) return;
    try {
      for (const [f, at] of [[440, 0], [480, 0], [440, 1.2], [480, 1.2]] as const) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
        o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.05); g.gain.setValueAtTime(0.06, t0 + 0.8); g.gain.linearRampToValueAtTime(0, t0 + 0.9);
        o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 0.95);
      }
    } catch { /* audio blocked until the user interacts with the page */ }
  };
  let flip = false;
  beep();
  const iv = setInterval(() => { flip = !flip; if (doc) doc.title = flip ? `📞 ${fromName} belt…` : title; if (!flip) beep(); }, 1500);
  return () => { clearInterval(iv); if (doc) doc.title = title; void ctx?.close().catch(() => {}); };
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-start', paddingTop: 70, paddingHorizontal: 16, backgroundColor: '#0008' },
  card: { backgroundColor: '#1b1430', borderRadius: 24, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ffffff22' },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.text, fontSize: 36, fontWeight: '800' },
  name: { color: C.text, fontSize: 22, fontWeight: '800' }, sub: { color: C.muted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 16, marginTop: 12 }, btn: { paddingVertical: 14, paddingHorizontal: 26, borderRadius: 30 }, btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
