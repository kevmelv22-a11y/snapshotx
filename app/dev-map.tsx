import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {FriendAvatar} from '../components/avatar/FriendAvatar';
import {MapPrivacySheet} from '../components/map/MapPrivacySheet';
import {DEFAULT_PRIVACY, enableGhost, ghostStatusText, isGhost, isLive, lastSeenText, sharingSummary, type MapPrivacy} from '../lib/map-privacy';

/** Dev-only harness for step 6 (kaart) with mock data; no Supabase, no native map (web mock view).
 *  ?scene=map|ghost|settings|selected|duration */
const NOW = Date.parse('2026-10-13T12:00:00Z'), MIN = 60000;
const FRIENDS = [
  {id: 'aria', name: 'Aria', x: 0.28, y: 0.32, ago: 1},
  {id: 'daan', name: 'Daan', x: 0.66, y: 0.42, ago: 12},
  {id: 'noor', name: 'Noor', x: 0.42, y: 0.62, ago: 140},
  {id: 'sem', name: 'Sem', x: 0.78, y: 0.7, ago: 60 * 30},
];
export default function DevMap() {
  return __DEV__ ? <DevMapScreen/> : null;
}

function DevMapScreen() {
  const {scene = 'map'} = useLocalSearchParams<{scene?: string}>();
  const init: MapPrivacy = scene === 'ghost' ? enableGhost({...DEFAULT_PRIVACY, audience: 'all'}, '3h', NOW - 45 * MIN)
    : scene === 'selected' ? {...DEFAULT_PRIVACY, audience: 'selected', allowedIds: ['aria', 'noor']} : {...DEFAULT_PRIVACY, audience: 'all'};
  const [privacy, setPrivacy] = useState(init);
  const [sheet, setSheet] = useState(scene === 'settings' || scene === 'selected' || scene === 'duration');
  const ghost = isGhost(privacy, NOW);
  return <View style={s.root}>
    <Stack.Screen options={{headerShown: false}}/>
    <View style={s.map}>
      {[...Array(9)].map((_, i) => <View key={'h' + i} style={[s.road, {top: `${8 + i * 11}%`, height: i % 3 ? 3 : 7, transform: [{rotate: `${(i % 2 ? -4 : 3)}deg`}]}]}/>)}
      {[...Array(6)].map((_, i) => <View key={'v' + i} style={[s.roadV, {left: `${10 + i * 16}%`, width: i % 2 ? 3 : 6}]}/>)}
      <View style={s.water}/><View style={s.park}/>
      {FRIENDS.map(f => { const at = new Date(NOW - f.ago * MIN).toISOString(); return <View key={f.id} style={[s.pin, {left: `${f.x * 100}%`, top: `${f.y * 100}%`, opacity: isLive(at, NOW) ? 1 : 0.6}]}>
        <FriendAvatar id={f.id} outfit={undefined} size={54} name={f.name}/>
        <View style={s.label}><Text style={s.labelName}>{f.name}</Text><Text style={s.labelSub}>{lastSeenText(at, NOW)}</Text></View>
      </View>; })}
      <View style={[s.pin, {left: '50%', top: '47%'}]}><View style={[s.me, ghost && {backgroundColor: '#777'}]}><Ionicons name={ghost ? 'eye-off' : 'person'} size={20} color="#fff"/></View><View style={s.label}><Text style={s.labelName}>Ik nu</Text></View></View>
    </View>
    <View style={s.top}>
      <Text style={s.title}>Kaart (mock-weergave)</Text>
      <Pressable style={[s.chip, !ghost && privacy.audience !== 'none' && {backgroundColor: '#8541B5'}]} onPress={() => setSheet(true)}>
        <Ionicons name={ghost ? 'eye-off' : 'location'} size={16} color="#fff"/><Text style={s.chipText}>{ghost ? ghostStatusText(privacy, NOW) : sharingSummary(privacy, NOW)}</Text>
      </Pressable>
    </View>
    {sheet && <View style={s.shade}><MapPrivacySheet privacy={privacy} now={NOW} friends={FRIENDS} onChange={setPrivacy} onClose={() => setSheet(false)} renderAvatar={f => <FriendAvatar id={f.id} outfit={undefined} size={34} name={f.name}/>}/></View>}
    {scene === 'duration' && <AutoDuration/>}
  </View>;
}
// Opens the duration picker for the screenshot by toggling the switch.
function AutoDuration() {
  React.useEffect(() => { const t = setTimeout(() => { (document.querySelector('[aria-label="Spookmodus"]') as HTMLElement | null)?.click(); }, 600); return () => clearTimeout(t); }, []);
  return null;
}
const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#E8E4DA'},
  map: {...StyleSheet.absoluteFill as object, backgroundColor: '#ECE8DE', overflow: 'hidden'},
  road: {position: 'absolute', left: -20, right: -20, backgroundColor: '#FFFFFF'},
  roadV: {position: 'absolute', top: 0, bottom: 0, backgroundColor: '#FFFFFF'},
  water: {position: 'absolute', right: -40, top: '10%', width: 160, height: 260, borderRadius: 80, backgroundColor: '#AAD3F2'},
  park: {position: 'absolute', left: '8%', bottom: '12%', width: 140, height: 90, borderRadius: 30, backgroundColor: '#C6E5B3'},
  pin: {position: 'absolute', alignItems: 'center', transform: [{translateX: -30}, {translateY: -40}]},
  me: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#4298FF', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  label: {backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center', marginTop: 2},
  labelName: {fontWeight: '800', fontSize: 12, color: '#1A1425'},
  labelSub: {fontSize: 10, color: '#555'},
  top: {position: 'absolute', top: 40, left: 14, right: 14, gap: 10},
  title: {fontSize: 18, fontWeight: '900', color: '#1A1425'},
  chip: {alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#241E32E8', borderRadius: 20, paddingHorizontal: 14, height: 37},
  chipText: {color: '#fff', fontWeight: '700'},
  shade: {...StyleSheet.absoluteFill as object, backgroundColor: '#000A', justifyContent: 'flex-end'},
});
