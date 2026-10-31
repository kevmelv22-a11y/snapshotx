import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import {router, useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import FriendMap from '../components/FriendMap';
import type {Pin, Point} from '../components/FriendMap.native';
import {OwnAvatar} from '../components/avatar/OwnAvatar';
import {FriendAvatar} from '../components/avatar/FriendAvatar';
import {useWardrobeSync} from '../hooks/useWardrobeSync';
import {useFriendOutfits} from '../hooks/useFriendOutfits';
import {useSession} from '../hooks/useSession';
import {DEMO_MODE, supabase} from '../lib/supabase';
import {readAvatarAppearance} from '../lib/avatar';
import {MapPrivacySheet, type PrivacyFriend} from '../components/map/MapPrivacySheet';
import {DEFAULT_PRIVACY, ghostStatusText, isGhost, isSharing, lastSeenText, privacyFromRow, privacyToRow, type MapPrivacy} from '../lib/map-privacy';

import {friendlyError} from '../lib/db-errors';
type LocationRow = {user_id: string; latitude: number; longitude: number; sharing: boolean; home_confirmed?: boolean; updated_at: string; share_audience?: string; ghost_until?: string | null; ghost_forever?: boolean};

/** Web demo (EXPO_PUBLIC_DEMO_MODE=1): no geolocation prompt, you stand in Arnhem like the iOS demo shots. */
const DEMO_WEB_POSITION = Platform.OS === 'web' && DEMO_MODE ? {latitude: 51.984, longitude: 5.905} : null;

export default function MapScreen() {
  const {session} = useSession();
  const uid = session?.user.id;
  const ownAppearance = readAvatarAppearance(session?.user.user_metadata?.snaplion_avatar);
  useWardrobeSync(uid);
  const insets = useSafeAreaInsets();
  const [pins, setPins] = useState<Pin[]>([]);
  const [own, setOwn] = useState<Pin | null>(null);
  const ownPin = React.useMemo<Pin | null>(() => own ?? (DEMO_WEB_POSITION && uid ? {id: uid, name: 'Ik nu', ...DEMO_WEB_POSITION} : null), [own, uid]);
  const [sharing, setSharing] = useState(false);
  const [homeConfirmed, setHomeConfirmed] = useState(false);
  const [homeAvailable, setHomeAvailable] = useState(false);
  const [trail, setTrail] = useState<Point[]>([]);
  const [footsteps, setFootsteps] = useState(false);
  // Measured heights of the floating header/footer: the web fallback list is padded to sit between them.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusOwn, setFocusOwn] = useState(0);
  const [focusNetherlands, setFocusNetherlands] = useState(0);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState<MapPrivacy>(DEFAULT_PRIVACY);
  const [privacyAvailable, setPrivacyAvailable] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyFriends, setPrivacyFriends] = useState<PrivacyFriend[]>([]);
  const [hasOwnRow, setHasOwnRow] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const sharingRef = useRef(false);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  const lastPublished = useRef(0);

  const load = useCallback(async () => {
    if (!uid) return;
    // Privacy columns come from migration 20261031150000_map_privacy_server (live); keep the legacy select as fallback.
    let {data, error} = await supabase.from('sx_locations').select('user_id,latitude,longitude,sharing,home_confirmed,updated_at,share_audience,ghost_until,ghost_forever');
    const hasPrivacy = !error;
    if (error) ({data, error} = await supabase.from('sx_locations').select('user_id,latitude,longitude,sharing,home_confirmed,updated_at'));
    setPrivacyAvailable(hasPrivacy);
    if (error) { setPins([]); setNotice(friendlyError(error, 'Kaart van vrienden')); return; }
    const rows = (data || []) as LocationRow[];
    setHomeAvailable(rows.some(row => Object.prototype.hasOwnProperty.call(row, 'home_confirmed')));
    const mine = rows.find(row => row.user_id === uid);
    setHasOwnRow(!!mine);
    let allowed: string[] = [];
    if (hasPrivacy && mine?.share_audience === 'selected') {
      const res = await supabase.from('sx_location_allowed').select('friend_id').eq('owner_id', uid);
      if (!res.error) allowed = (res.data || []).map(row => row.friend_id as string);
    }
    const nextPrivacy = privacyFromRow(mine, allowed);
    setPrivacy(nextPrivacy);
    const live = hasPrivacy ? isSharing(nextPrivacy, Date.now()) : !!mine?.sharing;
    setSharing(live);
    setHomeConfirmed(live && !!mine?.home_confirmed);
    sharingRef.current = live;
    const visible = rows.filter(row => row.user_id !== uid && row.sharing && new Date(row.updated_at).getTime() > Date.now() - 86400000);
    if (!visible.length) { setPins([]); return; }
    const {data:profiles, error:profileError} = await supabase.from('profiles').select('id,display_name,username').in('id', visible.map(row => row.user_id));
    if (profileError) { setNotice(friendlyError(profileError, 'Namen op de kaart')); return; }
    setPins(visible.map(row => {
      const profile = profiles?.find(person => person.id === row.user_id);
      return {id: row.user_id, name: profile?.display_name || profile?.username || 'Vriend', username: profile?.username || undefined, homeConfirmed: !!row.home_confirmed, latitude: row.latitude, longitude: row.longitude, updatedAt: row.updated_at};
    }));
  }, [uid]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { setFocused(false); clearInterval(timer); };
  }, [load]));

  useEffect(() => {
    if (!uid || !focused) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    if (DEMO_WEB_POSITION) return; // demo position is derived below (ownPin)
    void (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setOwn(null);
          if (sharingRef.current) {
            sharingRef.current = false;
            await pendingWrite.current;
            const update = homeAvailable ? {sharing: false, home_confirmed: false} : {sharing: false};
            const {error} = await supabase.from('sx_locations').update(update).eq('user_id', uid);
            if (error) throw error;
            setSharing(false);
            setHomeConfirmed(false);
          }
          setNotice('Geef locatietoegang om jezelf live op de kaart te zien.');
          return;
        }
        // expo-location rejects with long English native text (FunctionCallException … kCLErrorDomain error 0 when no fix
        // is available yet); keep that in the console and show a short Dutch notice instead.
        const first = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced}).catch((error: unknown) => {
          console.warn('Locatie bepalen mislukt', error);
          return null;
        });
        if (cancelled) return;
        if (!first) { setNotice('Je locatie kon niet worden bepaald. Controleer je locatie-instellingen en probeer het opnieuw.'); return; }
        setOwn({id: uid, name: 'Ik nu', latitude: first.coords.latitude, longitude: first.coords.longitude});
        // Watch errors (2nd callback) are transient CoreLocation hiccups that arrive as raw English native text; show a
        // Dutch notice instead, the watcher keeps running and recovers by itself.
        const watcher = await Location.watchPositionAsync({accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5}, position => {
          if (cancelled) return;
          const {latitude, longitude} = position.coords;
          setOwn({id: uid, name: 'Ik nu', latitude, longitude});
          setTrail(previous => [...previous.slice(-199), {latitude, longitude}]);
          if (!sharingRef.current) return;
          if (Date.now() - lastPublished.current < 15000) return;
          lastPublished.current = Date.now();
          pendingWrite.current = pendingWrite.current.then(async () => {
            if (!sharingRef.current) return;
            const {error} = await supabase.from('sx_locations').upsert({user_id: uid, latitude, longitude, sharing: true, updated_at: new Date().toISOString()});
            if (error) throw error;
          }).catch(error => { setNotice(friendlyError(error)); });
        }, () => setNotice('Je locatie kon even niet worden bepaald. We proberen het automatisch opnieuw.'));
        if (cancelled) watcher.remove(); else subscription = watcher;
      } catch (error) { if (!cancelled) setNotice(friendlyError(error)); }
    })();
    return () => { cancelled = true; subscription?.remove(); };
  }, [focused, homeAvailable, uid]);

  async function locate() {
    if (!uid) return;
    if (DEMO_WEB_POSITION) { setOwn({id: uid, name: 'Ik nu', ...DEMO_WEB_POSITION}); setFocusOwn(value => value + 1); return; }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Geef locatietoegang om jezelf op de kaart te zien.');
      const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
      setOwn({id: uid, name: 'Ik nu', latitude: position.coords.latitude, longitude: position.coords.longitude});
      setFocusOwn(value => value + 1);
      if (!sharing) setNotice('Alleen jij ziet deze locatie. Deel je locatie om zichtbaar te worden voor vrienden.');
    } catch (error) { setNotice(friendlyError(error)); }
  }

  async function toggleSharing() {
    if (!uid || busy) return;
    setBusy(true);
    try {
      if (sharing) {
        sharingRef.current = false;
        await pendingWrite.current;
        const update = homeAvailable ? {sharing: false, home_confirmed: false} : {sharing: false};
        const {error} = await supabase.from('sx_locations').update(update).eq('user_id', uid);
        if (error) { sharingRef.current = true; throw error; }
        setSharing(false);
        setHomeConfirmed(false);
        setNotice('Spookmodus aan. Vrienden kunnen je locatie niet meer opvragen.');
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Locatietoegang is nodig voordat je kunt delen.');
        const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
        const {latitude, longitude} = position.coords;
        const {error} = await supabase.from('sx_locations').upsert({user_id: uid, latitude, longitude, sharing: true, updated_at: new Date().toISOString()});
        if (error) throw error;
        setOwn({id: uid, name: 'Ik nu', latitude, longitude});
        setFocusOwn(value => value + 1);
        sharingRef.current = true;
        lastPublished.current = Date.now();
        setSharing(true);
        void load();
        setNotice('Je locatie wordt gedeeld met vrienden zolang je de kaart gebruikt, maximaal 24 uur na je laatste update.');
      }
    } catch (error) { setNotice(friendlyError(error)); }
    finally { setBusy(false); }
  }

  // Ghost timer countdown + re-evaluate sharing when a timed ghost mode runs out.
  useEffect(() => {
    if (!privacyAvailable) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      const live = isSharing(privacy, now);
      if (live !== sharingRef.current) { sharingRef.current = live; setSharing(live); if (live) lastPublished.current = 0; }
    }, 15000);
    return () => clearInterval(timer);
  }, [privacy, privacyAvailable]);

  async function openPrivacy() {
    if (!uid) return;
    if (!privacyAvailable) { void toggleSharing(); return; }
    setClock(Date.now());
    setPrivacyOpen(true);
    const f = await supabase.from('sx_friends').select('friend_id').eq('user_id', uid);
    if (f.error) { setNotice(friendlyError(f.error, 'Je vrienden')); return; }
    const ids = (f.data || []).map(row => row.friend_id as string);
    if (!ids.length) { setPrivacyFriends([]); return; }
    const p = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
    if (p.error) { setNotice(friendlyError(p.error, 'Je vrienden')); return; }
    setPrivacyFriends((p.data || []).map(row => ({id: row.id, name: row.display_name || row.username || 'Vriend'})));
  }

  async function savePrivacy(next: MapPrivacy) {
    if (!uid || busy) return;
    setBusy(true);
    const previous = privacy;
    setPrivacy(next);
    try {
      const now = Date.now();
      const live = isSharing(next, now);
      sharingRef.current = live;
      await pendingWrite.current;
      const row = {...privacyToRow(next), ...(live ? {} : {home_confirmed: false})};
      if (hasOwnRow) {
        const {error} = await supabase.from('sx_locations').update(row).eq('user_id', uid);
        if (error) throw error;
      } else {
        // First row needs coordinates.
        let pos = own;
        if (!pos) {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) throw new Error('Locatietoegang is nodig voordat je kunt delen.');
          const p = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
          pos = {id: uid, name: 'Ik nu', latitude: p.coords.latitude, longitude: p.coords.longitude};
          setOwn(pos);
        }
        const {error} = await supabase.from('sx_locations').upsert({user_id: uid, latitude: pos.latitude, longitude: pos.longitude, updated_at: new Date().toISOString(), ...row});
        if (error) throw error;
        setHasOwnRow(true);
      }
      const added = next.allowedIds.filter(id => !previous.allowedIds.includes(id));
      const removed = previous.allowedIds.filter(id => !next.allowedIds.includes(id));
      if (added.length) { const {error} = await supabase.from('sx_location_allowed').insert(added.map(friend_id => ({owner_id: uid, friend_id}))); if (error) throw error; }
      if (removed.length) { const {error} = await supabase.from('sx_location_allowed').delete().eq('owner_id', uid).in('friend_id', removed); if (error) throw error; }
      setSharing(live);
      if (!live) setHomeConfirmed(false);
      if (live) lastPublished.current = 0;
    } catch (error) {
      setPrivacy(previous);
      sharingRef.current = isSharing(previous, Date.now());
      setNotice(friendlyError(error, 'Instelling opslaan'));
    } finally { setBusy(false); }
  }

  async function toggleHome() {
    if (!uid || !sharing || !homeAvailable || busy) return;
    setBusy(true);
    const next = !homeConfirmed;
    const {error} = await supabase.from('sx_locations').update({home_confirmed: next}).eq('user_id', uid);
    if (error) setNotice(friendlyError(error, 'Thuisstatus opslaan'));
    else {setHomeConfirmed(next); setNotice(next ? 'Vrienden die je locatie mogen zien, zien nu jouw zelfgekozen thuisstatus.' : 'Thuisstatus uitgezet.');}
    setBusy(false);
  }

  // Friends' saved wardrobe outfits (batched + cached); friends without one keep the classic avatar art.
  const friendOutfits = useFriendOutfits(pins.map(pin => pin.id), {live: true});
  const filtered = pins.filter(pin => pin.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = pins.find(pin => pin.id === selectedId);
  return <View style={styles.root}>
    <FriendMap pins={filtered} own={ownPin} ownAppearance={ownAppearance} friendOutfits={friendOutfits} trail={footsteps ? trail : []} selectedId={selectedId} focusOwn={focusOwn} focusNetherlands={focusNetherlands} onSelect={setSelectedId} onLocate={() => void locate()} overlayInsets={{top: insets.top + 8 + headerHeight, bottom: footerHeight}}/>
    <View style={[styles.header, {top: insets.top + 8}]} pointerEvents="box-none" onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
      <View style={styles.titleRow}>
        <View style={styles.headerGroup}>
          <Pressable style={styles.round} onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Mijn profiel"><OwnAvatar userId={uid} size={42} appearance={ownAppearance}/></Pressable>
          <Pressable style={styles.round} onPress={() => {if (searchOpen) setQuery(''); setSearchOpen(value => !value);}} accessibilityLabel="Vrienden op de kaart zoeken"><Ionicons name="search" size={23} color="#fff"/></Pressable>
        </View>
        <View style={styles.placePill}><Text style={styles.title}>SnapShot X</Text><Text style={styles.placeSubtitle}>{selected ? selected.name : 'Nederland'}</Text></View>
        <Pressable style={styles.round} onPress={() => router.push('/settings')} accessibilityLabel="Kaartinstellingen"><Ionicons name="settings-outline" size={23} color="#fff"/></Pressable>
      </View>
      {searchOpen && <View style={styles.search}><Ionicons name="search" size={20} color="#D9D0E4"/><TextInput autoFocus style={styles.input} value={query} onChangeText={setQuery} placeholder="Zoek vrienden op de kaart" placeholderTextColor="#C5BFCF" accessibilityLabel="Zoek vrienden op de kaart"/><Pressable onPress={() => {setQuery(''); setSearchOpen(false);}} accessibilityLabel="Zoeken sluiten"><Ionicons name="close" size={20} color="#fff"/></Pressable></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable style={[styles.chip, sharing && styles.active]} disabled={busy} onPress={() => void openPrivacy()} accessibilityLabel="Locatie-instellingen en spookmodus"><Ionicons name={sharing ? 'location' : 'eye-off'} size={16} color="#fff"/><Text style={styles.chipText}>{privacyAvailable ? (isGhost(privacy, clock) ? ghostStatusText(privacy, clock) : sharing ? 'Locatie delen aan' : 'Locatie verborgen') : sharing ? 'Locatie delen aan' : 'Spookmodus aan'}</Text></Pressable>
        {sharing && homeAvailable && <Pressable style={[styles.chip, homeConfirmed && styles.homeActive]} disabled={busy} onPress={() => void toggleHome()} accessibilityLabel={homeConfirmed ? 'Thuisstatus uitzetten' : 'Zelf melden dat ik thuis ben'}><Ionicons name="home-outline" size={16} color="#fff"/><Text style={styles.chipText}>{homeConfirmed ? 'Ik ben thuis' : 'Thuisstatus'}</Text></Pressable>}
        <Pressable style={styles.chip} onPress={() => router.push('/(tabs)/friends')}><Ionicons name="people" size={16} color="#fff"/><Text style={styles.chipText}>Vrienden · {pins.length}</Text></Pressable>
      </ScrollView>
      {!!notice && <Pressable style={styles.notice} onPress={() => setNotice('')} accessibilityLabel="Melding sluiten"><Text style={styles.noticeText}>{notice}  ×</Text></Pressable>}
    </View>
    <View style={styles.footer} pointerEvents="box-none" onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => router.push('/memories')} accessibilityLabel="Herinneringen bekijken"><Ionicons name="albums-outline" size={17} color="#fff"/><Text style={styles.actionText}>Herinneringen</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push('/discover')} accessibilityLabel="Trending verhalen bekijken"><Ionicons name="flame-outline" size={17} color="#fff"/><Text style={styles.actionText}>Trending</Text></Pressable>
        <Pressable style={[styles.action, footsteps && styles.active]} onPress={() => setFootsteps(value => !value)} accessibilityLabel="Voetstappen tijdens deze sessie tonen"><Ionicons name="footsteps-outline" size={17} color="#fff"/><Text style={styles.actionText}>Voetstappen</Text></Pressable>
      </View>
      {selected ? <Pressable style={[styles.friendBanner, !selected.homeConfirmed && styles.friendNeutral]} onPress={() => setSelectedId(null)} accessibilityLabel={`Locatie van ${selected.name} sluiten`}><FriendAvatar id={selected.id} outfit={friendOutfits.get(selected.id)} size={35} name={selected.name}/><Text style={[styles.friendText, !selected.homeConfirmed && styles.friendNeutralText]}>{selected.homeConfirmed ? `🏠 ${selected.username || selected.name} 💙 is thuis` : `${selected.name} · ${selected.updatedAt ? `laatst gezien ${lastSeenText(selected.updatedAt, clock).toLocaleLowerCase()}` : 'deelt locatie met jou'}`}</Text><Ionicons name="close" size={18} color={selected.homeConfirmed ? '#251C21' : '#fff'}/></Pressable> :
        <View style={styles.hint}><Ionicons name="sparkles" size={17} color="#FFE436"/><Text style={styles.hintText}>{pins.length ? `${pins.length} vriend${pins.length === 1 ? '' : 'en'} op de kaart` : 'Nog geen vrienden die locatie delen'}</Text></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
        <Pressable style={styles.dockControl} onPress={() => setSearchOpen(true)} accessibilityLabel="Vrienden op kaart zoeken"><Ionicons name="search" size={27} color="#fff"/></Pressable>
        {ownPin && <Pressable style={styles.person} onPress={() => router.push('/avatar-editor')} accessibilityLabel="Mijn personage aanpassen"><OwnAvatar userId={ownPin.id} size={58} selected appearance={ownAppearance}/><Text style={styles.personName}>Ik nu</Text></Pressable>}
        {filtered.map(pin => <Pressable key={pin.id} style={styles.person} onPress={() => setSelectedId(pin.id)} accessibilityLabel={`Locatie van ${pin.name} bekijken`}><FriendAvatar id={pin.id} outfit={friendOutfits.get(pin.id)} size={58} selected={pin.id === selectedId} name={pin.name}/><Text numberOfLines={1} style={styles.personName}>{pin.name}</Text></Pressable>)}
        {!filtered.length && <Pressable style={styles.emptyPerson} onPress={() => router.push('/(tabs)/friends')}><Ionicons name="person-add" size={22} color="#FFE436"/><Text style={styles.personName}>{query ? 'Geen resultaat' : 'Voeg vrienden toe'}</Text></Pressable>}
        <Pressable style={styles.dockControl} onPress={() => setFocusNetherlands(value => value + 1)} accessibilityLabel="Heel Nederland bekijken"><Ionicons name="map-outline" size={26} color="#fff"/></Pressable>
      </ScrollView>
    </View>
    <Modal visible={privacyOpen} transparent animationType="slide" onRequestClose={() => setPrivacyOpen(false)}>
      <View style={styles.modalShade}><MapPrivacySheet privacy={privacy} friends={privacyFriends} now={clock} busy={busy} onChange={next => void savePrivacy(next)} onClose={() => setPrivacyOpen(false)} renderAvatar={f => <FriendAvatar id={f.id} outfit={friendOutfits.get(f.id)} size={34} name={f.name}/>}/></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#100C1B'},
  header: {position: 'absolute', left: 0, right: 0, paddingHorizontal: 14, gap: 9},
  titleRow: {height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerGroup: {flexDirection: 'row', gap: 8},
  placePill: {flex: 1, maxWidth: 190, minWidth: 110, height: 48, marginHorizontal: 8, backgroundColor: '#191923EF', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF18'},
  title: {fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.4},
  placeSubtitle: {fontSize: 12, color: '#C3BCD1', fontWeight: '600'},
  round: {width: 45, height: 45, borderRadius: 24, backgroundColor: '#241E32E8', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'},
  active: {backgroundColor: '#8541B5'},
  homeActive: {backgroundColor: '#785814'},
  search: {height: 48, backgroundColor: '#251F32ED', borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8},
  input: {flex: 1, fontSize: 15, color: '#fff'},
  chips: {gap: 8, paddingBottom: 4},
  chip: {height: 37, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#241E32E8', alignItems: 'center', flexDirection: 'row', gap: 7},
  chipText: {color: '#fff', fontWeight: '700', fontSize: 13},
  notice: {backgroundColor: '#282037F0', borderRadius: 12, padding: 11},
  noticeText: {color: '#fff', fontSize: 13, lineHeight: 19},
  footer: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 8, gap: 9},
  friendBanner: {minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFE436', borderRadius: 17, paddingHorizontal: 12, marginHorizontal: 14, alignSelf: 'flex-start', maxWidth: '92%'},
  friendText: {color: '#251C21', fontWeight: '900', fontSize: 14, flexShrink: 1},
  friendNeutral: {backgroundColor: '#241E32F0'},
  friendNeutralText: {color: '#fff'},
  hint: {backgroundColor: '#241E32E8', borderRadius: 17, padding: 11, flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: 14, alignSelf: 'flex-start'},
  hintText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  actions: {flexDirection: 'row', gap: 5, marginHorizontal: 10, justifyContent: 'space-around'},
  action: {backgroundColor: '#171921EF', borderRadius: 18, paddingHorizontal: 9, height: 39, flexDirection: 'row', alignItems: 'center', gap: 4},
  actionText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  people: {gap: 14, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#110C1BD9', minWidth: '100%', alignItems: 'center'},
  dockControl: {height: 57, width: 57, borderRadius: 29, backgroundColor: '#1B1C25F0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF22'},
  person: {width: 65, alignItems: 'center', gap: 3},
  personName: {color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', maxWidth: 75},
  emptyPerson: {height: 75, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 15, backgroundColor: '#312347'},
  modalShade: {flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A'},
});
