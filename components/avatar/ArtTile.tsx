/**
 * Avatar-kast tile look (dark card, soft radial glow, blue ring when selected) around the shared
 * ChatGPT-style renderer (OutfitArt). Used by the avatar editor so its tiles match the Kast exactly.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { OutfitArt, outfitArtId } from './OutfitArt';
import type { Outfit } from '../../lib/avatar/outfit';

export const KAST_BLUE = '#0A7CFF';

/** Same glow as the Kast look cards. */
export function CardGlow({ width, height }: { width: number; height: number }) {
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
    <Defs><RadialGradient id="artTileGlow" cx="50%" cy="38%" r="70%"><Stop offset="0" stopColor="#3A3A3D"/><Stop offset="1" stopColor="#1C1C1E"/></RadialGradient></Defs>
    <Rect width={width} height={height} fill="url(#artTileGlow)"/>
  </Svg>;
}

/** Same stage as the Kast hero (dark radial spot + floor). */
export function KastStage({ width, height }: { width: number; height: number }) {
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
    <Defs>
      <RadialGradient id="artStage" cx="50%" cy="40%" r="75%"><Stop offset="0" stopColor="#38383B"/><Stop offset="0.38" stopColor="#2C2C2E"/><Stop offset="0.75" stopColor="#141415"/><Stop offset="1" stopColor="#000"/></RadialGradient>
      <RadialGradient id="artFloor" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#4A4A4E" stopOpacity={0.55}/><Stop offset="1" stopColor="#2C2C2E" stopOpacity={0}/></RadialGradient>
    </Defs>
    <Rect width={width} height={height} fill="url(#artStage)"/>
    <Ellipse cx={width / 2} cy={height * 0.86} rx={width * 0.62} ry={height * 0.16} fill="url(#artFloor)"/>
  </Svg>;
}

export function ArtTile({ outfit, width, imageHeight, label, meta, selected, badge, onPress, accessibilityLabel, testID }: {
  outfit: Outfit; width: number; imageHeight: number; label: string; meta?: string; selected?: boolean; badge?: string;
  onPress: () => void; accessibilityLabel?: string; testID?: string;
}) {
  const inner = width - 5;
  return <Pressable onPress={onPress} style={[s.ring, { width }, selected && { borderColor: KAST_BLUE }]} accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: !!selected }} testID={testID}>
    <View style={s.card}>
      <View style={{ width: inner, height: imageHeight }} testID={testID ? `${testID}:art:${outfitArtId(outfit)}` : undefined}>
        <CardGlow width={inner} height={imageHeight}/>
        <OutfitArt outfit={outfit} width={inner} height={imageHeight - 6}/>
        {!!badge && <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>}
      </View>
      <View style={s.text}>
        <Text style={s.name} numberOfLines={1}>{label}</Text>
        {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
      </View>
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  ring: { borderRadius: 15, borderWidth: 2.5, borderColor: 'transparent' },
  card: { borderRadius: 12, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  text: { paddingHorizontal: 8, paddingVertical: 7 },
  name: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  meta: { color: '#8E8E93', fontSize: 11.5, marginTop: 2 },
  badge: { position: 'absolute', right: 6, bottom: 4, width: 21, height: 21, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: -1 },
});
