import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import MapView, {Marker, type Region} from 'react-native-maps';

export type Pin = {id: string; name: string; latitude: number; longitude: number};
type Props = {pins: Pin[]; own: Pin | null; selectedId: string | null; focusOwn: number; onSelect: (id: string | null) => void; onLocate: () => void};

const NETHERLANDS: Region = {latitude: 52.09, longitude: 5.12, latitudeDelta: 0.13, longitudeDelta: 0.13};
const MIN_DELTA = 0.002;
const MAX_DELTA = 24;

export default function FriendMap({pins, own, selectedId, focusOwn, onSelect, onLocate}: Props) {
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

  return <View style={styles.root}>
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={NETHERLANDS}
      onMapReady={() => setReady(true)}
      onRegionChangeComplete={next => { region.current = next; }}
      onPress={() => onSelect(null)}
      showsCompass
      showsScale
      accessibilityLabel="Interactieve kaart van Nederland"
    >
      {pins.map(pin => <Marker
        key={pin.id}
        coordinate={{latitude: pin.latitude, longitude: pin.longitude}}
        onPress={() => onSelect(pin.id)}
        title={pin.name}
        description="Deelt locatie met vrienden"
      >
        <View style={[styles.pin, selectedId === pin.id && styles.pinSelected]}><Text style={styles.initial}>{pin.name.charAt(0).toUpperCase()}</Text></View>
      </Marker>)}
      {own && <Marker coordinate={{latitude: own.latitude, longitude: own.longitude}} title="Jij" description="Jouw huidige locatie" zIndex={2}>
        <View style={styles.myPin}><Ionicons name="person" color="#141119" size={21}/></View>
      </Marker>}
    </MapView>
    <View style={styles.controls} pointerEvents="box-none">
      <Pressable style={styles.control} onPress={() => zoom(0.55)} accessibilityLabel="Inzoomen"><Ionicons name="add" size={25} color="#fff"/></Pressable>
      <Pressable style={styles.control} onPress={() => zoom(1.8)} accessibilityLabel="Uitzoomen"><Ionicons name="remove" size={25} color="#fff"/></Pressable>
      <Pressable style={[styles.control, styles.locate]} onPress={onLocate} accessibilityLabel="Ga naar mijn locatie"><Ionicons name="locate" size={23} color="#fff"/></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1},
  pin: {width: 44, height: 44, borderRadius: 22, backgroundColor: '#7046A6', borderColor: '#fff', borderWidth: 3, alignItems: 'center', justifyContent: 'center', elevation: 4},
  pinSelected: {backgroundColor: '#AD39D7', borderColor: '#FFE436'},
  initial: {color: '#fff', fontSize: 20, fontWeight: '900'},
  myPin: {width: 45, height: 45, borderRadius: 23, backgroundColor: '#FFE436', borderColor: '#fff', borderWidth: 3, alignItems: 'center', justifyContent: 'center', elevation: 5},
  controls: {position: 'absolute', right: 15, bottom: 100, gap: 9},
  control: {height: 45, width: 45, borderRadius: 23, backgroundColor: '#211B30E8', justifyContent: 'center', alignItems: 'center', elevation: 4},
  locate: {backgroundColor: '#7835AA'},
});
