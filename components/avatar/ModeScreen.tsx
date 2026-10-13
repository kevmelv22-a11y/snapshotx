/**
 * Mode screen (step 8, layout after the user's reference): full-body avatar on yellow, "Probeer een nieuwe look"
 * 3×2 grid, yellow "Meer mode bekijken" button and bottom tabs Mode / Kast / Avatar. Presentational: the route
 * (app/avatar/mode.tsx) and the dev screen pass the outfit and handlers.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { applyLook, DEFAULT_OUTFIT, type Outfit } from '../../lib/avatar/outfit';
import { TRY_LOOKS } from '../../lib/avatar/modeLooks';
import type { PoseId } from '../../lib/avatar/poses';
import { FigureArt } from './AvatarArt';
import { WardrobePortrait } from './OwnAvatar';
import { PosedAvatar } from './PosedAvatar';
import { Avatar3DView } from '../avatar3d/Avatar3DView';
import { Avatar3DImage } from '../avatar3d/Avatar3D';
import { ArtImage, poseArtFor } from './ArtImage';
import { LOOK_ART } from '../../lib/avatar/avatarArt';

const YELLOW = '#FFE11A';
type Props = { outfit: Outfit; pose?: PoseId; selectedLook?: string | null; onPickLook: (id: string, outfit: Outfit) => void; onMore: () => void; onClose: () => void; onTab: (t: 'mode' | 'kast' | 'avatar') => void; topInset?: number; bottomInset?: number };

export function ModeScreen({ outfit, pose = 'stand', selectedLook, onPickLook, onMore, onClose, onTab, topInset = 12, bottomInset = 8 }: Props) {
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);
  const heroH = Math.max(300, Math.min(height * 0.44, 440));
  const cardW = (W - 32 - 16) / 3;
  return <View style={s.root}>
    <View style={{ height: heroH, backgroundColor: YELLOW }}>
      <Svg width="100%" height={heroH} style={StyleSheet.absoluteFill}>
        <Defs><RadialGradient id="modeGlow" cx="0.5" cy="0.45" r="0.6"><Stop offset="0" stopColor="#FFF27A" stopOpacity={0.9}/><Stop offset="1" stopColor={YELLOW} stopOpacity={0}/></RadialGradient>
          <RadialGradient id="modeShadow" cx="0.5" cy="0.5" r="0.5"><Stop offset="0" stopColor="#8A6D00" stopOpacity={0.35}/><Stop offset="1" stopColor="#8A6D00" stopOpacity={0}/></RadialGradient></Defs>
        <Rect width="100%" height={heroH} fill="url(#modeGlow)"/>
      </Svg>
      <View style={{ position: 'absolute', left: (width - heroH * 0.62) / 2, top: 6 }}>
        {/* Default: pre-rendered art (default character; hair/skin personalisation not shown). The reference
            "thinking" pose stands in for the default pose. Without art: 3D (web) with 2D fallback. */}
        {(() => { const art = poseArtFor(outfit, pose === 'stand' ? 'think' : pose); return art
          ? <ArtImage art={art} width={heroH * 0.62} height={heroH - 26} testID={`mode-hero-art:${art}`}/>
          : <Avatar3DView outfit={outfit} pose={pose === 'stand' ? 'think' : pose} framing="hero" width={heroH * 0.62} height={heroH - 8} testID="mode-hero-3d"
          fallback={<View style={{ paddingLeft: heroH * 0.05 }}><PosedAvatar outfit={outfit} pose={pose} width={heroH * 0.52} height={heroH * 0.99}/></View>}/>; })()}
      </View>
      <Pressable onPress={onClose} style={[s.close, { top: topInset + 12 }]} accessibilityRole="button" accessibilityLabel="Sluiten"><Ionicons name="close" size={28} color="#111"/></Pressable>
      <Text style={[s.brand, { top: topInset + 22 }]}>Snapshot X</Text>
    </View>
    <View style={[s.sheet, { width: W, alignSelf: 'center' }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
        <View style={s.headRow}><Text style={s.title}>Probeer een nieuwe look</Text><Pressable onPress={onMore} accessibilityRole="link"><Text style={s.more}>Bekijk alles  ›</Text></Pressable></View>
        <View style={s.grid}>
          {TRY_LOOKS.map(look => {
            const o = applyLook(outfit ?? DEFAULT_OUTFIT, look.items);
            const on = selectedLook === look.id;
            return <Pressable key={look.id} onPress={() => onPickLook(look.id, o)} style={[s.card, { width: cardW, height: cardW * 1.08 }, on && s.cardOn]} accessibilityRole="button" accessibilityLabel={`Look ${look.name}: ${look.tagline}`}>
              {LOOK_ART[look.id] ? <View style={{ padding: 6 }}><ArtImage art={LOOK_ART[look.id]} width={cardW - 16} height={cardW * 1.08 - 16} testID={`mode-look-art:${look.id}`}/></View> : <Avatar3DImage outfit={o} framing="card" width={cardW - 4} height={cardW * 1.08 - 4} testID={`mode-look-3d:${look.id}`}
                fallback={<FigureArt outfit={{ ...o, hairStyle: o.hairStyle }} width={cardW} height={cardW * 1.08} crop={[40, 108, 120, 250]}/>}/>}
            </Pressable>;
          })}
        </View>
        <Pressable onPress={onMore} style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]} accessibilityRole="button"><Text style={s.ctaText}>Meer mode bekijken</Text></Pressable>
      </ScrollView>
      <View style={[s.tabs, { paddingBottom: bottomInset + 6 }]}>
        <Pressable style={s.tab} onPress={() => onTab('mode')} accessibilityRole="tab" accessibilityState={{ selected: true }}><Text style={[s.tabText, s.tabOn]}>Mode</Text><View style={s.tabLine}/></Pressable>
        <View style={s.tabSep}/>
        <Pressable style={s.tab} onPress={() => onTab('kast')} accessibilityRole="tab"><Text style={s.tabText}>Kast</Text></Pressable>
        <View style={s.tabSep}/>
        <Pressable style={[s.tab, { flexDirection: 'row', gap: 8 }]} onPress={() => onTab('avatar')} accessibilityRole="tab"><WardrobePortrait outfit={outfit} size={30}/><Text style={s.tabText}>Avatar</Text></Pressable>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1C1E' },
  close: { position: 'absolute', left: 18, width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', right: 22, fontSize: 22, fontWeight: '900', color: '#111' },
  sheet: { flex: 1, marginTop: -18, backgroundColor: '#1C1C1E', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#FFF', fontSize: 23, fontWeight: '900' },
  more: { color: '#AEAEB2', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { backgroundColor: '#2C2C2F', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: YELLOW },
  cta: { marginTop: 14, backgroundColor: YELLOW, borderRadius: 28, paddingVertical: 15, alignItems: 'center' },
  ctaText: { color: '#111', fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A3A3C', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  tabText: { color: '#8E8E93', fontSize: 18, fontWeight: '700' },
  tabOn: { color: '#FFF' },
  tabLine: { position: 'absolute', bottom: -2, left: 18, right: 18, height: 3, borderRadius: 2, backgroundColor: '#FFF' },
  tabSep: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: '#3A3A3C' },
});
