import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {FriendMapProps} from './FriendMap.native';
import {FriendAvatar} from './avatar/FriendAvatar';
import {OwnAvatar} from './avatar/OwnAvatar';
import {useNow} from '../hooks/useNow';
import {lastSeenText} from '../lib/map-privacy';

export default function FriendMap({pins, own, ownAppearance, friendOutfits, selectedId, onSelect, onLocate}: FriendMapProps) {
  const now = useNow();
  return <View style={styles.root}>
    <Text style={styles.title}>Kaart op je telefoon</Text>
    <Text style={styles.description}>De interactieve kaart gebruikt de native iOS- of Android-kaart in Snapshot X. Hier zie je alleen vrienden die locatie delen.</Text>
    {own && <Pressable onPress={onLocate} style={styles.row}><OwnAvatar userId={own.id} size={44} appearance={ownAppearance}/><Text style={styles.name}>Jij · locatie beschikbaar</Text></Pressable>}
    {pins.map(pin => <Pressable key={pin.id} onPress={() => onSelect(pin.id)} style={[styles.row, selectedId === pin.id && styles.selected]}>
      <FriendAvatar id={pin.id} outfit={friendOutfits?.get(pin.id)} size={44} name={pin.name} selected={selectedId === pin.id}/>
      <View style={styles.copy}><Text style={styles.name}>{pin.name}</Text><Text style={styles.sub}>{pin.updatedAt ? `Laatst gezien: ${lastSeenText(pin.updatedAt, now)}` : 'Deelt locatie met jou'}</Text></View>
    </Pressable>)}
    {!pins.length && <Text style={styles.description}>Nog geen vrienden op de kaart.</Text>}
  </View>;
}
const styles = StyleSheet.create({root: {flex: 1, padding: 22, backgroundColor: '#11111B'}, title: {fontSize: 22, fontWeight: '800', color: '#fff'}, description: {fontSize: 15, lineHeight: 22, color: '#CCC4D4', marginTop: 12}, row: {padding: 12, marginTop: 12, backgroundColor: '#282238', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12}, copy: {flex: 1}, selected: {borderWidth: 1, borderColor: '#FFE436'}, name: {fontSize: 16, fontWeight: '700', color: '#fff'}, sub: {fontSize: 13, color: '#C9BFD4'}});
