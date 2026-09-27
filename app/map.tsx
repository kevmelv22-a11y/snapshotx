import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import {router, useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import FriendMap from '../components/FriendMap';
import type {Pin} from '../components/FriendMap.native';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';

type LocationRow = {user_id: string; latitude: number; longitude: number; sharing: boolean; updated_at: string};

export default function MapScreen() {
  const {session} = useSession();
  const uid = session?.user.id;
  const insets = useSafeAreaInsets();
  const [pins, setPins] = useState<Pin[]>([]);
  const [own, setOwn] = useState<Pin | null>(null);
  const [sharing, setSharing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusOwn, setFocusOwn] = useState(0);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const sharingRef = useRef(false);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  const lastPublished = useRef(0);

  const load = useCallback(async () => {
    if (!uid) return;
    const {data, error} = await supabase.from('sx_locations').select('user_id,latitude,longitude,sharing,updated_at');
    if (error) { setNotice(error.message); return; }
    const rows = (data || []) as LocationRow[];
    const mine = rows.find(row => row.user_id === uid);
    setSharing(!!mine?.sharing);
    sharingRef.current = !!mine?.sharing;
    if (mine) setOwn({id: uid, name: 'Jij', latitude: mine.latitude, longitude: mine.longitude});
    const visible = rows.filter(row => row.user_id !== uid && row.sharing && new Date(row.updated_at).getTime() > Date.now() - 86400000);
    if (!visible.length) { setPins([]); return; }
    const {data:profiles, error:profileError} = await supabase.from('profiles').select('id,display_name,username').in('id', visible.map(row => row.user_id));
    if (profileError) { setNotice(profileError.message); return; }
    setPins(visible.map(row => {
      const profile = profiles?.find(person => person.id === row.user_id);
      return {id: row.user_id, name: profile?.username ? `@${profile.username}` : profile?.display_name || 'Vriend', latitude: row.latitude, longitude: row.longitude};
    }));
  }, [uid]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { setFocused(false); clearInterval(timer); };
  }, [load]));

  useEffect(() => {
    if (!uid || !focused || !sharing) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          sharingRef.current = false;
          await pendingWrite.current;
          const {error} = await supabase.from('sx_locations').update({sharing: false}).eq('user_id', uid);
          if (error) throw error;
          setSharing(false);
          setNotice('Locatietoegang is uitgeschakeld. Ghost mode staat aan.');
          return;
        }
        const watcher = await Location.watchPositionAsync({accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20}, position => {
          if (cancelled || !sharingRef.current) return;
          const {latitude, longitude} = position.coords;
          setOwn({id: uid, name: 'Jij', latitude, longitude});
          if (Date.now() - lastPublished.current < 15000) return;
          lastPublished.current = Date.now();
          pendingWrite.current = pendingWrite.current.then(async () => {
            if (!sharingRef.current) return;
            const {error} = await supabase.from('sx_locations').upsert({user_id: uid, latitude, longitude, sharing: true, updated_at: new Date().toISOString()});
            if (error) throw error;
          }).catch(error => { setNotice((error as Error).message); });
        }, reason => setNotice(reason));
        if (cancelled) watcher.remove(); else subscription = watcher;
      } catch (error) { if (!cancelled) setNotice((error as Error).message); }
    })();
    return () => { cancelled = true; subscription?.remove(); };
  }, [focused, sharing, uid]);

  async function locate() {
    if (!uid) return;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Geef locatietoegang om jezelf op de kaart te zien.');
      const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
      setOwn({id: uid, name: 'Jij', latitude: position.coords.latitude, longitude: position.coords.longitude});
      setFocusOwn(value => value + 1);
      if (!sharing) setNotice('Alleen jij ziet deze locatie. Deel je locatie om zichtbaar te worden voor vrienden.');
    } catch (error) { setNotice((error as Error).message); }
  }

  async function toggleSharing() {
    if (!uid || busy) return;
    setBusy(true);
    try {
      if (sharing) {
        sharingRef.current = false;
        await pendingWrite.current;
        const {error} = await supabase.from('sx_locations').update({sharing: false}).eq('user_id', uid);
        if (error) { sharingRef.current = true; throw error; }
        setSharing(false);
        setNotice('Ghost mode aan. Vrienden kunnen je locatie niet meer opvragen.');
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Locatietoegang is nodig voordat je kunt delen.');
        const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
        const {latitude, longitude} = position.coords;
        const {error} = await supabase.from('sx_locations').upsert({user_id: uid, latitude, longitude, sharing: true, updated_at: new Date().toISOString()});
        if (error) throw error;
        setOwn({id: uid, name: 'Jij', latitude, longitude});
        setFocusOwn(value => value + 1);
        sharingRef.current = true;
        lastPublished.current = Date.now();
        setSharing(true);
        setNotice('Je locatie wordt gedeeld met vrienden zolang je de kaart gebruikt, maximaal 24 uur na je laatste update.');
      }
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  const filtered = pins.filter(pin => pin.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = pins.find(pin => pin.id === selectedId);
  return <View style={styles.root}>
    <FriendMap pins={filtered} own={own} selectedId={selectedId} focusOwn={focusOwn} onSelect={setSelectedId} onLocate={() => void locate()}/>
    <View style={[styles.header, {top: insets.top + 8}]} pointerEvents="box-none">
      <View style={styles.titleRow}>
        <Pressable style={styles.round} onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Mijn profiel"><Ionicons name="person-outline" size={22} color="#fff"/></Pressable>
        <Text style={styles.title}>Kaart</Text>
        <Pressable style={[styles.round, sharing && styles.active]} disabled={busy} onPress={() => void toggleSharing()} accessibilityLabel={sharing ? 'Ghost mode aanzetten' : 'Locatie delen met vrienden'}><Ionicons name={sharing ? 'location' : 'eye-off-outline'} size={23} color="#fff"/></Pressable>
      </View>
      <View style={styles.search}><Ionicons name="search" size={20} color="#D9D0E4"/><TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Zoek vrienden op de kaart" placeholderTextColor="#C5BFCF" accessibilityLabel="Zoek vrienden op de kaart"/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable style={styles.chip} onPress={() => void locate()}><Ionicons name="navigate" size={16} color="#fff"/><Text style={styles.chipText}>Mijn locatie</Text></Pressable>
        <Pressable style={styles.chip} onPress={() => router.push('/(tabs)/friends')}><Ionicons name="people" size={16} color="#fff"/><Text style={styles.chipText}>Vrienden · {pins.length}</Text></Pressable>
        <Pressable style={[styles.chip, sharing && styles.active]} disabled={busy} onPress={() => void toggleSharing()}><Ionicons name={sharing ? 'location' : 'eye-off'} size={16} color="#fff"/><Text style={styles.chipText}>{sharing ? 'Locatie delen aan' : 'Ghost mode aan'}</Text></Pressable>
      </ScrollView>
      {!!notice && <Pressable style={styles.notice} onPress={() => setNotice('')} accessibilityLabel="Melding sluiten"><Text style={styles.noticeText}>{notice}  ×</Text></Pressable>}
    </View>
    <View style={styles.footer} pointerEvents="box-none">
      {selected ? <Pressable style={styles.friendBanner} onPress={() => setSelectedId(null)} accessibilityLabel={`Locatie van ${selected.name} sluiten`}><Text style={styles.friendText}>📍 {selected.name} deelt locatie met jou</Text><Ionicons name="close" size={18} color="#251C21"/></Pressable> :
        <View style={styles.hint}><Text style={styles.hintText}>{pins.length ? `${pins.length} vriend${pins.length === 1 ? '' : 'en'} op de kaart` : 'Nog geen vrienden die locatie delen'} · {sharing ? 'Je deelt je locatie' : 'Ghost mode'}</Text></View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#11111B'},
  header: {position: 'absolute', left: 0, right: 0, paddingHorizontal: 14, gap: 9},
  titleRow: {height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 27, fontWeight: '900', color: '#fff', textShadowColor: '#0009', textShadowRadius: 9},
  round: {width: 45, height: 45, borderRadius: 24, backgroundColor: '#241E32E8', justifyContent: 'center', alignItems: 'center'},
  active: {backgroundColor: '#8541B5'},
  search: {height: 48, backgroundColor: '#251F32ED', borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8},
  input: {flex: 1, fontSize: 15, color: '#fff'},
  chips: {gap: 8, paddingBottom: 4},
  chip: {height: 37, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#241E32E8', alignItems: 'center', flexDirection: 'row', gap: 7},
  chipText: {color: '#fff', fontWeight: '700', fontSize: 13},
  notice: {backgroundColor: '#282037F0', borderRadius: 12, padding: 11},
  noticeText: {color: '#fff', fontSize: 13, lineHeight: 19},
  footer: {position: 'absolute', left: 14, right: 75, bottom: 17},
  friendBanner: {minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFE436', borderRadius: 17, paddingHorizontal: 14},
  friendText: {color: '#251C21', fontWeight: '900', fontSize: 14, flexShrink: 1},
  hint: {backgroundColor: '#241E32E8', borderRadius: 17, padding: 13},
  hintText: {color: '#fff', fontSize: 12, fontWeight: '700'},
});
