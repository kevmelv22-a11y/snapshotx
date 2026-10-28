import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { C } from '../lib/theme';
import { buildPayload, MemoryTokenStore, MockPushProvider, registerForPush, type Delivered, type PushEvent } from '../lib/backend/push';
import { DAY, HOUR, expiresAt, expiryReason, remainingLabel, sweep, type Ephemeral } from '../lib/backend/disappear';
import { MockStorage } from '../lib/backend/storage';

/** Dev-only Step 9 harness: MOCK push provider, MOCK token store, MOCK storage, pure disappear rules.
 *  No Supabase. ?push=N pre-sends N demo notifications; ?t=<seconds> advances the simulated clock. */
const T0 = Date.parse('2026-10-13T12:00:00Z');
const UID = '11111111-2222-3333-4444-555555555555';
const DEMO: PushEvent[] = [
  { kind: 'snap', from: 'Aria', threadId: 't1' },
  { kind: 'chat', from: 'Bram', threadId: 't2', preview: 'Zin in zaterdag?' },
  { kind: 'screenshot', from: 'Cleo', threadId: 't3', what: 'snap' },
  { kind: 'friend_request', from: 'Daan', requestId: 'r1' },
];
type Row = { id: string; label: string; item: Ephemeral };
const ROWS: Row[] = [
  { id: 'a', label: 'Snap van Aria · bekeken, 5s timer', item: { kind: 'snap', createdAt: T0 - HOUR, timerS: 5, openedAt: T0 } },
  { id: 'b', label: 'Snap van Bram · 10s, herbekeken', item: { kind: 'snap', createdAt: T0 - HOUR, timerS: 10, openedAt: T0, replayed: true } },
  { id: 'c', label: 'Snap van Cleo · ongeopend', item: { kind: 'snap', createdAt: T0 - 29 * DAY, timerS: 3, openedAt: null } },
  { id: 'd', label: 'Snap van Daan · bewaard in chat', item: { kind: 'snap', createdAt: T0, timerS: 5, openedAt: T0, saved: true } },
  { id: 'e', label: 'Verhaal van jou', item: { kind: 'story', createdAt: T0 - 20 * HOUR } },
  { id: 'f', label: 'Chat Aria · "Na bekijken"', item: { kind: 'chat', createdAt: T0, viewedAt: T0, leftAt: T0, retention: 'after_view' } },
  { id: 'g', label: 'Chat Bram · "24 uur"', item: { kind: 'chat', createdAt: T0, viewedAt: T0, retention: '24h' } },
  { id: 'h', label: 'Chat Cleo · "Bewaren"', item: { kind: 'chat', createdAt: T0, viewedAt: T0, retention: 'keep' } },
  { id: 'i', label: 'Chat Eva · "24 uur", 3 dagen ongeopend', item: { kind: 'chat', createdAt: T0 - 3 * DAY, viewedAt: null, retention: '24h' } },
  { id: 'j', label: 'Chat Finn · "24 uur", 31 dagen ongeopend', item: { kind: 'chat', createdAt: T0 - 31 * DAY, viewedAt: null, retention: '24h' } },
];
const REASON: Record<string, string> = { viewed: 'bekeken + timer', 'unopened-30d': '30 dagen ongeopend', 'story-24h': '24 uur', 'chat-retention': 'chatinstelling', 'chat-unopened-31d': '31 dagen ongeopend' };

export default function DevBackend() {
  const q = useLocalSearchParams<{ push?: string; t?: string }>();
  const provider = useMemo(() => new MockPushProvider(true, () => T0), []);
  const tokens = useMemo(() => new MemoryTokenStore(), []);
  const storage = useMemo(() => new MockStorage(), []);
  const [feed, setFeed] = useState<Delivered[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [stored, setStored] = useState<string[]>([]);
  const [now, setNow] = useState(T0 + Number(q.t ?? 0) * 1000);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const off = provider.onReceive(d => setFeed(f => [d, ...f]));
    registerForPush(provider, tokens, { platform: 'web', deviceId: 'dev-web' }).then(setToken);
    (async () => {
      const paths: string[] = [];
      for (const k of ['snap', 'story', 'memory'] as const) paths.push((await storage.upload({ kind: k, type: 'photo', ownerId: UID, bytes: new Uint8Array(2048), id: `demo-${k}` })).bucket + '/' + (k));
      setStored(paths);
      for (const e of DEMO.slice(0, Number(q.push ?? 0))) await provider.present(buildPayload(e));
    })();
    return off;
  }, [provider, tokens, storage, q.push]);

  const r = sweep(ROWS.map(x => x.item), now);
  const advance = (ms: number) => {
    const before = sweep(ROWS.map(x => x.item), now).deleted.length, after = sweep(ROWS.map(x => x.item), now + ms).deleted.length;
    setNow(now + ms); setLog(l => [`+${ms >= DAY ? ms / DAY + ' d' : ms >= HOUR ? ms / HOUR + ' u' : ms / 1000 + ' s'} → ${after - before} verwijderd`, ...l].slice(0, 4));
  };
  const t = (n: number) => Math.round((n - T0) / 1000);
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.p}>
    <Stack.Screen options={{ title: 'Backend (mock)' }} />
    <Text style={s.h}>Push · MockPushProvider</Text>
    <Text style={s.m}>Token (MemoryTokenStore → sx_push_tokens in echt): {token ?? '…'}</Text>
    <View style={s.row}>{DEMO.map(e => <Pressable key={e.kind} style={s.btn} onPress={() => provider.present(buildPayload(e))}><Text style={s.bt}>{e.kind.replace('_', ' ')}</Text></Pressable>)}</View>
    {feed.map(d => <View key={d.id} style={s.note} testID="push-note">
      <View style={s.ic}><Text style={{ fontSize: 16 }}>👻</Text></View>
      <View style={{ flex: 1 }}><Text style={s.nt}>{d.title}</Text><Text style={s.nb}>{d.body}</Text></View>
      <Text style={s.small}>{d.data.kind}{'\n'}{d.data.route}</Text>
    </View>)}
    {feed.length === 0 && <Text style={s.m}>Nog geen meldingen — tik op een knop.</Text>}

    <Text style={[s.h, { marginTop: 22 }]}>Verdwijnen · gesimuleerde klok T+{t(now)}s</Text>
    <View style={s.row}>{[[5000, '+5 s'], [10000, '+10 s'], [HOUR, '+1 u'], [4 * HOUR, '+4 u'], [DAY, '+1 d']].map(([ms, l]) =>
      <Pressable key={l} style={s.btn} onPress={() => advance(ms as number)}><Text style={s.bt}>{l}</Text></Pressable>)}
      <Pressable style={[s.btn, { backgroundColor: C.surface }]} onPress={() => { setNow(T0); setLog([]); }}><Text style={[s.bt, { color: 'white' }]}>reset</Text></Pressable></View>
    {log.map((l, i) => <Text key={i} style={s.small}>{l}</Text>)}
    {ROWS.map(x => { const gone = r.deleted.some(d => d.item === x.item); const e = expiresAt(x.item);
      return <View key={x.id} style={[s.item, gone && s.gone]}>
        <Text style={[s.nt, gone && { textDecorationLine: 'line-through', color: C.muted }]}>{x.label}</Text>
        <Text style={[s.pill, gone ? s.pillGone : e == null ? s.pillKeep : null]}>{gone ? `verwijderd · ${REASON[expiryReason(x.item)]}` : remainingLabel(x.item, now)}</Text>
      </View>; })}
    <Text style={s.small}>{r.keep.length} over · {r.deleted.length} verwijderd. Server: app_private.sx_disappear_cleanup() (migratie, niet toegepast).</Text>

    <Text style={[s.h, { marginTop: 22 }]}>Opslag · MockStorage</Text>
    <Text style={s.m}>{storage.objects.size} objecten in geheugen: {[...storage.objects.keys()].map(k => k.replace(UID, '<uid>')).join(', ') || stored.join(', ')}</Text>
  </ScrollView>;
}
const s = StyleSheet.create({
  p: { padding: 16, gap: 8, paddingBottom: 60 }, h: { color: 'white', fontSize: 18, fontWeight: '800' }, m: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 11 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { backgroundColor: '#FFFC00', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }, bt: { color: '#111', fontWeight: '800', fontSize: 13 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#2a2a2e', borderRadius: 16, padding: 12 },
  ic: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FFFC00', alignItems: 'center', justifyContent: 'center' },
  nt: { color: 'white', fontWeight: '700', fontSize: 14, flexShrink: 1 }, nb: { color: '#ddd', fontSize: 13 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 12, padding: 12 },
  gone: { opacity: 0.55 }, pill: { color: '#111', backgroundColor: '#FFFC00', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '800', fontSize: 12, overflow: 'hidden' },
  pillGone: { backgroundColor: '#FF4D5E', color: 'white' }, pillKeep: { backgroundColor: '#3ddc84' },
});
