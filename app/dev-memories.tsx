import React, {useState} from 'react';
import {Text, View} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {MemoriesView, MemoryDetail} from '../components/memories/MemoriesView';
import {dayKey, registerPinAttempt, sectionTitle, togglePrivate, type Memory, type PinLock} from '../lib/memories';

/** Dev-only harness for step 7 (Herinneringen) with mock data; no Supabase.
 *  ?scene=grid|private|pin|wrongpin|unlocked|detail  (PIN in mock = 2580). */
const NOW = Date.parse('2026-10-13T12:00:00Z'), TZ = -120;
const COLORS = ['#FF5B95', '#4298FF', '#FFB347', '#7BD389', '#AE16C7', '#43C6DB', '#F67280', '#C06C84'];
const EMOJI = ['🌅', '🍕', '🎉', '🐶', '🏖️', '🚲', '🎸', '❄️'];
const mk = (id: number, iso: string, extra: Partial<Memory> = {}): Memory => ({id: String(id), storage_path: `mock/${id}`, media_type: id % 5 === 0 ? 'video' : 'photo', created_at: iso, ...extra});
const MOCK: Memory[] = [
  mk(1, '2026-10-13T08:10:00Z'), mk(2, '2026-10-13T07:00:00Z'), mk(3, '2026-10-12T18:00:00Z'), mk(4, '2026-10-12T17:00:00Z'), mk(5, '2026-10-12T09:00:00Z'),
  mk(6, '2026-10-09T15:00:00Z'), mk(7, '2026-09-30T10:00:00Z'), mk(8, '2025-10-13T16:00:00Z', {caption: 'Strand!'}), mk(9, '2025-10-13T17:00:00Z'), mk(10, '2023-10-13T12:00:00Z'),
  mk(11, '2026-10-11T20:00:00Z', {private: true}), mk(12, '2026-08-02T20:00:00Z', {private: true}), mk(13, '2024-10-13T12:00:00Z', {private: true}),
];
const thumb = (m: Memory, style: any) => { const i = +m.id % 8; return <View style={[style, {backgroundColor: COLORS[i], alignItems: 'center', justifyContent: 'center'}]}><Text style={{fontSize: 34}}>{EMOJI[i]}</Text><Text style={{color: '#fff', fontSize: 10, fontWeight: '700'}}>{new Date(m.created_at).toLocaleDateString('nl-NL')}</Text></View>; };
export default function DevMemories() {
  return __DEV__ ? <DevMemoriesScreen/> : null;
}

function DevMemoriesScreen() {
  const {scene = 'grid'} = useLocalSearchParams<{scene?: string}>();
  const [items, setItems] = useState(MOCK);
  const [tab, setTab] = useState<'all' | 'private'>(scene === 'grid' || scene === 'detail' || scene === 'resend' ? 'all' : 'private');
  const [unlocked, setUnlocked] = useState(scene === 'unlocked');
  const [lock, setLock] = useState<PinLock>(scene === 'wrongpin' ? {failures: 2, lockedUntil: null} : {failures: 0, lockedUntil: null});
  const [open, setOpen] = useState<Memory | null>(scene === 'detail' || scene === 'resend' ? MOCK[7] : null);
  const [notice, setNotice] = useState('');
  return <View style={{flex: 1}}>
    <Stack.Screen options={{title: 'Herinneringen (mock)'}}/>
    {open ? <MemoryDetail initialPicking={scene === 'resend'} memory={open} title={sectionTitle(dayKey(open.created_at, TZ), dayKey(new Date(NOW).toISOString(), TZ))} renderThumb={thumb} targets={[{id: 'aria', name: 'Aria'}, {id: 'daan', name: 'Daan'}, {id: 'noor', name: 'Noor'}]}
      onResend={ids => { setOpen(null); setNotice(`Verstuurd naar ${ids.length} vriend${ids.length === 1 ? '' : 'en'}.`); }} onTogglePrivate={() => { setItems(l => togglePrivate(l, open.id, !open.private)); setOpen(null); }} onClose={() => setOpen(null)}/> :
    <MemoriesView memories={items} now={NOW} tzOffsetMin={TZ} renderThumb={thumb} tab={tab} onTab={setTab} vaultUnlocked={unlocked} hasPin lock={lock} notice={notice}
      onSubmitPin={pin => { const ok = pin === '2580'; setLock(l => registerPinAttempt(l, ok, Date.now())); if (ok) setUnlocked(true); }} onOpen={setOpen}/>}
  </View>;
}
