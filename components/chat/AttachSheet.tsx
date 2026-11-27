import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';

export type AttachOption = {key: string; label: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void};
/** The chat "+" menu: Foto of video, Mijn locatie (one-off pin), … Bottom sheet; back/outside closes it. */
export function AttachSheet({visible, options, onClose}: {visible: boolean; options: AttachOption[]; onClose: () => void}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Sluiten"/>
    <View style={s.sheet} testID="attach-sheet">
      <View style={s.handle}/>
      {options.map(o => <Pressable key={o.key} onPress={() => { onClose(); o.onPress(); }} style={s.row} accessibilityRole="button" accessibilityLabel={o.label} testID={`attach-${o.key}`}>
        <View style={s.icon}><Ionicons name={o.icon} size={22} color={C.yellow}/></View>
        <View style={{flex: 1}}><Text style={s.label}>{o.label}</Text><Text style={s.sub}>{o.sub}</Text></View>
      </Pressable>)}
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: '#0008'},
  sheet: {backgroundColor: '#17131F', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 26, paddingTop: 8},
  handle: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF40', marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12},
  icon: {width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center'},
  label: {color: C.text, fontSize: 16, fontWeight: '800'},
  sub: {color: '#A9A3B5', fontSize: 13, marginTop: 1},
});
