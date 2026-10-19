/**
 * Huidskleur / Haarkleur / Kapsel as art tiles (head-and-shoulders crops of the composited avatar in each option),
 * shared by the avatar editor's and the Avatar-kast's Avatar tab. Values live in Outfit.colors (lib/avatar/tones)
 * and are saved with the per-account outfit like the clothes.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { HAIRSTYLES, HAIR_COLORS, SKIN_TONES, hairColorOf, hairStyleOf, skinToneOf, withHairColor, withHairStyle, withSkinTone } from '../../lib/avatar/tones';
import { AvatarBust } from './AvatarBust';
import { CardGlow, KAST_BLUE } from './ArtTile';

export function AppearanceTile({ outfit, size, label, selected, onPress, swatch, testID }: { outfit: Outfit; size: number; label: string; selected: boolean; onPress: () => void; swatch?: string; testID?: string }) {
  const inner = size - 5;
  return <Pressable onPress={onPress} style={[s.ring, { width: size }, selected && { borderColor: KAST_BLUE }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} testID={testID}>
    <View style={s.card}>
      <View style={{ width: inner, height: inner }}>
        <CardGlow width={inner} height={inner}/>
        <AvatarBust outfit={outfit} size={inner} composite square background="transparent" label={label}/>
      </View>
      <View style={s.text}>
        {!!swatch && <View style={[s.swatch, { backgroundColor: swatch }]}/>}
        <Text style={s.name} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  </Pressable>;
}

export function AppearancePicker({ outfit, onChange, tileSize = 92, titleStyle, hintStyle }: { outfit: Outfit; onChange: (next: Outfit, label: string) => void; tileSize?: number; titleStyle?: object; hintStyle?: object }) {
  const g = outfit.gender === 'female' ? 'female' : 'male';
  const skin = skinToneOf(outfit), hair = hairColorOf(outfit), style = hairStyleOf(outfit), styles = HAIRSTYLES[g];
  return <View testID="appearance-picker">
    <Text style={[s.title, titleStyle]}>Huidskleur</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {SKIN_TONES.map(t => <AppearanceTile key={t.id} outfit={withSkinTone(outfit, t.id)} size={tileSize} label={t.label} swatch={t.hex} selected={skin === t.id}
        onPress={() => onChange(withSkinTone(outfit, t.id), `huidskleur ${t.label.toLowerCase()}`)} testID={`appearance-skin:${t.id}${skin === t.id ? ':selected' : ''}`}/>)}
    </ScrollView>
    <Text style={[s.title, titleStyle]}>Haarkleur</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {HAIR_COLORS.map(t => <AppearanceTile key={t.id} outfit={withHairColor(outfit, t.id)} size={tileSize} label={t.label} swatch={t.hex} selected={hair === t.id}
        onPress={() => onChange(withHairColor(outfit, t.id), `haarkleur ${t.label.toLowerCase()}`)} testID={`appearance-hair:${t.id}${hair === t.id ? ':selected' : ''}`}/>)}
    </ScrollView>
    <Text style={[s.title, titleStyle]}>Kapsel</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {styles.map(t => <AppearanceTile key={t.id} outfit={withHairStyle(outfit, t.id)} size={tileSize} label={t.label} selected={style === t.id}
        onPress={() => onChange(withHairStyle(outfit, t.id), `kapsel ${t.label.toLowerCase()}`)} testID={`appearance-hairstyle:${t.id}${style === t.id ? ':selected' : ''}`}/>)}
    </ScrollView>
    <Text style={[s.hint, hintStyle]}>{styles.length > 1 ? 'Een pet of muts gaat over je kapsel heen.' : 'Een pet of muts gaat over je kapsel heen. Meer kapsels komen eraan.'}</Text>
  </View>;
}

const s = StyleSheet.create({
  title: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  hint: { color: '#8E8E93', fontSize: 12, marginTop: 2, marginBottom: 10, lineHeight: 17 },
  row: { gap: 8, paddingRight: 12 },
  ring: { borderRadius: 15, borderWidth: 2.5, borderColor: 'transparent' },
  card: { borderRadius: 12, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  text: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 7 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)' },
  name: { color: '#FFF', fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
});
