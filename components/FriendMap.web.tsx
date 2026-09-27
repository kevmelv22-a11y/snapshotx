import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {Pin} from './FriendMap.native';

type Props = {pins: Pin[]; own: Pin | null; selectedId: string | null; focusOwn: number; onSelect: (id: string | null) => void; onLocate: () => void};
export default function FriendMap({pins, own, selectedId, onSelect, onLocate}: Props) {
  return <View style={styles.root}>
    <Text style={styles.title}>Kaart op je telefoon</Text>
    <Text style={styles.description}>De interactieve kaart gebruikt de native iOS- of Android-kaart in de SnapShot X-app. Hier zie je alleen vrienden die locatie delen.</Text>
    {own && <Pressable onPress={onLocate} style={styles.row}><Text style={styles.name}>Jij · locatie beschikbaar</Text></Pressable>}
    {pins.map(pin => <Pressable key={pin.id} onPress={() => onSelect(pin.id)} style={[styles.row, selectedId === pin.id && styles.selected]}><Text style={styles.name}>{pin.name}</Text><Text style={styles.sub}>Deelt locatie met jou</Text></Pressable>)}
    {!pins.length && <Text style={styles.description}>Nog geen vrienden op de kaart.</Text>}
  </View>;
}
const styles = StyleSheet.create({root: {flex: 1, padding: 22, backgroundColor: '#11111B'}, title: {fontSize: 22, fontWeight: '800', color: '#fff'}, description: {fontSize: 15, lineHeight: 22, color: '#CCC4D4', marginTop: 12}, row: {padding: 15, marginTop: 12, backgroundColor: '#282238', borderRadius: 16}, selected: {borderWidth: 1, borderColor: '#FFE436'}, name: {fontSize: 16, fontWeight: '700', color: '#fff'}, sub: {fontSize: 13, color: '#C9BFD4'}});
