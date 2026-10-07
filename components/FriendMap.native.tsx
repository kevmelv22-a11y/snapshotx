import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import MapView, {Marker, Polyline, type Region} from 'react-native-maps';
import {FriendAvatarFigure} from './avatar/FriendAvatar';
import {OwnAvatarFigure} from './avatar/OwnAvatar';
import {useOwnOutfit} from '../hooks/useWardrobeSync';
import type {AvatarAppearance} from '../lib/avatar';
import type {FriendOutfitValue} from '../hooks/useFriendOutfits';

export type Pin = {id: string; name: string; username?: string; homeConfirmed?: boolean; latitude: number; longitude: number};
export type Point = {latitude: number; longitude: number};
export type FriendMapProps = {pins: Pin[]; own: Pin | null; ownAppearance?: AvatarAppearance; /** Friends' saved wardrobe outfits ('pending' = neutral placeholder, missing = classic art). */ friendOutfits?: ReadonlyMap<string, FriendOutfitValue>; trail: Point[]; selectedId: string | null; focusOwn: number; focusNetherlands: number; onSelect: (id: string | null) => void; onLocate: () => void};

/*
 * Custom avatar markers (react-native-svg inside react-native-maps <Marker>):
 * - Every marker child has a FIXED width/height (no intrinsic sizing), so the native marker view is
 *   never measured as 0×0 / clipped while the SVG is still laying out.
 * - collapsable={false} keeps the wrapper view on Android so the snapshot isn't blank.
 * - tracksViewChanges is true for a short moment after mount and whenever the avatar changes (outfit
 *   arrives from the cache, selection, own outfit/appearance edit), then false. Google Maps (Android, or
 *   iOS with the Google provider) snapshots the view: switching it off too early gives blank markers,
 *   leaving it on re-renders bitmaps every frame. Apple Maps (iOS default, no provider set here) hosts
 *   the live view and ignores this prop.
 * - Feet on the coordinate: `anchor` for Google Maps, `centerOffset` (points) for Apple Maps, which
 *   otherwise centres the view on the coordinate.
 * No native modules beyond react-native-maps / react-native-svg (both already in the app).
 */
const FIG_W = 82;
const FIG_H = Math.round(FIG_W * 119 / 82);
const FRIEND_W = 88;
const FRIEND_H = FIG_H + 4;
const OWN_W = 100;
const OWN_FEET = FIG_H + 2; // feet line inside the own marker (the "Ik nu" badge hangs below it)
const OWN_H = OWN_FEET + 34;
const TRACK_MS = 700;

/** true right after mount and after `key` changes, false once the SVG had time to draw. */
function useTracksViewChanges(key: string): boolean {
  const [state, setState] = useState({key, tracking: true});
  if (state.key !== key) setState({key, tracking: true});
  const tracking = state.key !== key || state.tracking;
  useEffect(() => {
    if (!tracking) return;
    const timer = setTimeout(() => setState(current => current.key === key ? {key, tracking: false} : current), TRACK_MS);
    return () => clearTimeout(timer);
  }, [key, tracking]);
  return tracking;
}

const FriendMarker = React.memo(function FriendMarker({pin, outfit, selected, onSelect}: {pin: Pin; outfit: FriendOutfitValue | undefined; selected: boolean; onSelect: (id: string | null) => void}) {
  const tracks = useTracksViewChanges(`${selected ? 1 : 0}|${outfit ? JSON.stringify(outfit) : '-'}`);
  return <Marker
    coordinate={{latitude: pin.latitude, longitude: pin.longitude}}
    onPress={() => onSelect(pin.id)}
    title={pin.name}
    description="Deelt locatie met vrienden"
    anchor={{x: 0.5, y: 1}}
    centerOffset={{x: 0, y: -FRIEND_H / 2}}
    tracksViewChanges={tracks}
  >
    <View collapsable={false} style={[styles.avatarPin, selected && styles.selectedPin]}><FriendAvatarFigure id={pin.id} outfit={outfit} size={FIG_W}/></View>
  </Marker>;
});

function OwnMarker({own, appearance}: {own: Pin; appearance?: AvatarAppearance}) {
  const outfit = useOwnOutfit(own.id);
  const tracks = useTracksViewChanges(`${outfit ? JSON.stringify(outfit) : '-'}|${appearance ? JSON.stringify(appearance) : '-'}`);
  return <Marker
    coordinate={{latitude: own.latitude, longitude: own.longitude}}
    title="Jij"
    description="Jouw huidige locatie"
    zIndex={2}
    anchor={{x: 0.5, y: OWN_FEET / OWN_H}}
    centerOffset={{x: 0, y: OWN_H / 2 - OWN_FEET}}
    tracksViewChanges={tracks}
  >
    <View collapsable={false} style={styles.ownMarker}><View style={styles.glow}><OwnAvatarFigure userId={own.id} appearance={appearance} size={FIG_W}/></View><View style={styles.nowBadge}><Text style={styles.nowText}>Ik nu</Text></View></View>
  </Marker>;
}

// Start at a city scale in central Netherlands. The map itself has no pan
// boundary, so Zeeland, the Wadden and every other Dutch region remain reachable.
const NETHERLANDS: Region = {latitude: 52.09, longitude: 5.12, latitudeDelta: 0.10, longitudeDelta: 0.10};
const DUTCH_EXTENT: Point[] = [{latitude: 53.60, longitude: 3.15}, {latitude: 50.70, longitude: 7.30}];
const MIN_DELTA = 0.002;
const MAX_DELTA = 24;
const DARK_MAP = [
  {elementType: 'geometry', stylers: [{color: '#171324'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#AFA3C5'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#21182D'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#282044'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#39314C'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
];

export default function FriendMap({pins, own, ownAppearance, friendOutfits, trail, selectedId, focusOwn, focusNetherlands, onSelect, onLocate}: FriendMapProps) {
  const map = useRef<MapView>(null);
  const region = useRef<Region>(NETHERLANDS);
  const [ready, setReady] = useState(false);
  const centeredOnMe = useRef(false);

  useEffect(() => {
    if (!ready || !own || centeredOnMe.current) return;
    centeredOnMe.current = true;
    region.current = {...region.current, latitude: own.latitude, longitude: own.longitude};
    map.current?.animateToRegion(region.current, 550);
  }, [own, ready]);

  useEffect(() => {
    if (!ready || !own || !focusOwn) return;
    region.current = {...region.current, latitude: own.latitude, longitude: own.longitude};
    map.current?.animateToRegion(region.current, 450);
  // focusOwn is an explicit recenter request; regular location updates do not move the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOwn, ready]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const pin = pins.find(item => item.id === selectedId);
    if (!pin) return;
    region.current = {...region.current, latitude: pin.latitude, longitude: pin.longitude};
    map.current?.animateToRegion(region.current, 500);
  }, [pins, ready, selectedId]);

  function zoom(factor: number) {
    const current = region.current;
    region.current = {
      ...current,
      latitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.latitudeDelta * factor)),
      longitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.longitudeDelta * factor)),
    };
    map.current?.animateToRegion(region.current, 220);
  }

  function showNetherlands() {
    onSelect(null);
    map.current?.fitToCoordinates(DUTCH_EXTENT, {edgePadding: {top: 100, right: 42, bottom: 200, left: 42}, animated: true});
  }

  useEffect(() => {
    if (ready && focusNetherlands) showNetherlands();
  // The counter represents a user action; map readiness is handled here too.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNetherlands, ready]);

  return <View style={styles.root}>
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={NETHERLANDS}
      userInterfaceStyle="dark"
      customMapStyle={[...DARK_MAP]}
      onMapReady={() => setReady(true)}
      onRegionChangeComplete={next => { region.current = next; }}
      onPress={() => onSelect(null)}
      showsCompass
      showsScale
      zoomEnabled
      scrollEnabled
      rotateEnabled
      pitchEnabled={false}
      minZoomLevel={3}
      maxZoomLevel={20}
      accessibilityLabel="Interactieve kaart van Nederland"
    >
      {trail.length > 1 && <Polyline coordinates={trail} strokeColor="#FFE436" strokeWidth={4} lineDashPattern={[4, 5]}/>}
      {pins.map(pin => <FriendMarker key={pin.id} pin={pin} outfit={friendOutfits?.get(pin.id)} selected={selectedId === pin.id} onSelect={onSelect}/>)}
      {own && <OwnMarker own={own} appearance={ownAppearance}/>}
    </MapView>
    <View style={styles.controls} pointerEvents="box-none">
      <Pressable style={styles.control} onPress={() => zoom(0.55)} accessibilityLabel="Inzoomen"><Ionicons name="add" size={25} color="#fff"/></Pressable>
      <Pressable style={styles.control} onPress={() => zoom(1.8)} accessibilityLabel="Uitzoomen"><Ionicons name="remove" size={25} color="#fff"/></Pressable>
      <Pressable style={styles.control} onPress={showNetherlands} accessibilityLabel="Heel Nederland bekijken"><Ionicons name="globe-outline" size={24} color="#fff"/></Pressable>
      <Pressable style={[styles.control, styles.locate]} onPress={onLocate} accessibilityLabel="Ga naar mijn locatie"><Ionicons name="locate" size={23} color="#25112F"/></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1},
  avatarPin: {width: FRIEND_W, height: FRIEND_H, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible'},
  selectedPin: {backgroundColor: '#AE57DB22', borderRadius: 35},
  ownMarker: {alignItems: 'center', width: OWN_W, height: OWN_H, overflow: 'visible'},
  glow: {width: FIG_W, height: FIG_H, marginTop: 2, borderRadius: 38, backgroundColor: '#FFE43622', shadowColor: '#FFE436', shadowOpacity: 0.95, shadowRadius: 18, shadowOffset: {width: 0, height: 0}, elevation: 10},
  nowBadge: {marginTop: -4, borderRadius: 15, backgroundColor: '#FFE436', paddingHorizontal: 13, paddingVertical: 5, shadowColor: '#FFE436', shadowOpacity: 0.9, shadowRadius: 12, elevation: 8},
  nowText: {color: '#211428', fontSize: 13, fontWeight: '900'},
  controls: {position: 'absolute', right: 15, bottom: 210, gap: 9},
  control: {height: 45, width: 45, borderRadius: 23, backgroundColor: '#211B30E8', justifyContent: 'center', alignItems: 'center', elevation: 4},
  locate: {backgroundColor: '#FFE436'},
});
