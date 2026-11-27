import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {SPOT_LABEL, type SpotShare} from '../../lib/spotlight-share';
import {C} from '../../lib/theme';

/** A Spotlight snap sent in chat: caption + "Bekijk in Spotlight" (opens Uitgelicht with that snap first). */
export function SpotlightBubble({spot, creator}: {spot: SpotShare; creator: string | null}) {
  return <Pressable onPress={() => router.push({pathname: '/uitgelicht', params: {id: spot.id}})} style={s.card} accessibilityRole="link" accessibilityLabel={SPOT_LABEL.open} testID="chat-spotlight">
    <View style={s.icon}><Ionicons name="play" size={22} color="#111"/></View>
    <View style={{flex: 1, gap: 2}}>
      <Text style={s.kicker} numberOfLines={1}>SPOTLIGHT{creator ? ` · ${creator}` : ''}</Text>
      <Text style={s.caption} numberOfLines={2}>{spot.caption || 'Spotlight-snap'}</Text>
      <Text style={s.open}>{SPOT_LABEL.open} ›</Text>
    </View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: {width: 250, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: '#1F1A2B', borderWidth: 1, borderColor: '#FFFFFF1A', marginTop: 2},
  icon: {width: 44, height: 44, borderRadius: 12, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center'},
  kicker: {color: C.yellow, fontSize: 11, fontWeight: '900', letterSpacing: .5},
  caption: {color: C.text, fontSize: 15, fontWeight: '700'},
  open: {color: '#CFC8DC', fontSize: 13, fontWeight: '700', marginTop: 2},
});
