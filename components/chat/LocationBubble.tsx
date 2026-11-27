import React from 'react';
import {Linking, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LOCATION_LABEL, accuracyText, formatCoords, mapsUrl, type ChatLocation} from '../../lib/chat-location';
import {C} from '../../lib/theme';

/** One-off location pin in a chat: who shared it, coordinates, accuracy, and "Openen in Kaarten". */
export function LocationBubble({loc, mine, senderName}: {loc: ChatLocation; mine: boolean; senderName: string}) {
  const url = mapsUrl(loc, Platform.OS), acc = accuracyText(loc);
  return <View style={s.card} testID="chat-location">
    <View style={s.map}><View style={s.road1}/><View style={s.road2}/><View style={s.pin}><Ionicons name="location" size={34} color="#FF3B5C"/></View></View>
    <View style={s.body}>
      <Text style={s.title}>{mine ? LOCATION_LABEL.mine : `${senderName} ${LOCATION_LABEL.theirs}`}</Text>
      <Text style={s.coords} selectable>{formatCoords(loc)}</Text>
      {!!acc && <Text style={s.acc}>{acc}</Text>}
      <Pressable onPress={() => void Linking.openURL(url).catch(() => {})} style={s.open} accessibilityRole="link" accessibilityLabel={LOCATION_LABEL.open} testID="chat-location-open"><Ionicons name="map-outline" size={16} color="#111"/><Text style={s.openText}>{LOCATION_LABEL.open}</Text></Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: {width: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1F1A2B', borderWidth: 1, borderColor: '#FFFFFF1A', marginTop: 2},
  map: {height: 96, backgroundColor: '#2E4B3C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  road1: {position: 'absolute', left: -20, right: -20, top: 40, height: 10, backgroundColor: '#E9E2C8', transform: [{rotate: '-12deg'}]},
  road2: {position: 'absolute', top: -20, bottom: -20, left: 140, width: 8, backgroundColor: '#E9E2C8', transform: [{rotate: '18deg'}]},
  pin: {width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFFE6', alignItems: 'center', justifyContent: 'center'},
  body: {padding: 12, gap: 3},
  title: {color: C.text, fontWeight: '800', fontSize: 14},
  coords: {color: '#CFC8DC', fontSize: 13},
  acc: {color: '#9E97AC', fontSize: 12},
  open: {marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.yellow, borderRadius: 18, paddingVertical: 8},
  openText: {color: '#111', fontWeight: '800', fontSize: 13},
});
