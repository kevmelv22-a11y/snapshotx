/**
 * Profile screen layout (step 8, after the user's reference): dark green, username + score, big yellow avatar
 * circle, "Mijn Verhaal", "Vrienden" avatar row, map card with "Avatar Locatie" pin, "Afteltimers".
 * Presentational only: app/(tabs)/profile.tsx loads the data, app/dev-avatar.tsx passes mock data.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Outfit } from '../../lib/avatar/outfit';
import type { StoryRingState } from '../../lib/avatar/poses';
import { AvatarStoryRing } from '../avatar/AvatarStoryRing';
import { WardrobePortrait } from '../avatar/OwnAvatar';

export type ProfileFriend = { id: string; name: string; outfit: Outfit | null; ring?: StoryRingState; fallback?: React.ReactNode };
type Props = {
  username: string; nameBadge?: React.ReactNode; score: number; hero: React.ReactNode; ownOutfit: Outfit | null; friends: ProfileFriend[]; storyCount: number; sharingLocation: boolean;
  topInset?: number; onMenu: () => void; onSettings: () => void; onAvatar: () => void; onStory: () => void; onFriends: () => void; onFriend?: (id: string) => void; onMap: () => void; onTimers: () => void;
  /** Up to 3 upcoming Afteltimers (emoji, title, "Nog 12 dagen"). */ timers?: { id: string; emoji: string; title: string; label: string }[];
  footer?: React.ReactNode;
};

const fmt = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function ProfileHome(p: Props) {
  return <ScrollView style={s.root} contentContainerStyle={{ paddingTop: (p.topInset ?? 0) + 10, paddingHorizontal: 14, paddingBottom: 40 }}>
    <View style={s.top}>
      <Pressable onPress={p.onMenu} accessibilityLabel="Menu" hitSlop={8}><Ionicons name="menu" size={32} color="#FFF"/></Pressable>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}><Text style={s.user} numberOfLines={1}>{p.username.toUpperCase()}</Text>{p.nameBadge}</View>
        <Text style={s.score}>★ Mijn score is {fmt(p.score)}</Text>
      </View>
      <Pressable onPress={p.onSettings} accessibilityLabel="Instellingen" hitSlop={8}><Ionicons name="settings-outline" size={30} color="#FFF"/></Pressable>
    </View>
    <Pressable onPress={p.onAvatar} style={s.heroWrap} accessibilityRole="button" accessibilityLabel="Avatar aanpassen">{p.hero}</Pressable>

    <Pressable onPress={p.onStory} style={s.card} accessibilityRole="button">
      <View style={{ flex: 1 }}><Text style={s.cardTitle}>Mijn Verhaal</Text><Text style={s.cardSub}>{p.storyCount ? `${p.storyCount} snap${p.storyCount === 1 ? '' : 's'} in je Verhaal` : 'Voeg een Snap toe aan je Verhaal.'}</Text></View>
      <Ionicons name="chevron-forward" size={24} color="#FFF"/>
    </Pressable>

    <View style={s.card2}>
      <Pressable onPress={p.onFriends} style={s.cardHead}><Text style={s.cardTitle}>Vrienden</Text><Text style={s.link}>Bekijk alle  ›</Text></Pressable>
      {p.friends.length ? <View style={s.friendRow}>{p.friends.slice(0, 4).map(f => <Pressable key={f.id} onPress={() => p.onFriend?.(f.id)} accessibilityLabel={`Avatar van ${f.name}`} style={s.friendCell}>
        <AvatarStoryRing outfit={f.outfit} state={f.ring ?? 'none'} size={72} fallback={f.fallback}/>
      </Pressable>)}</View> : <Text style={s.cardSub}>Nog geen vrienden. Voeg iemand toe!</Text>}
    </View>

    <View style={s.card2}>
      <Pressable onPress={p.onMap} style={s.cardHead}><Text style={s.cardTitle}>Kaart</Text><Text style={s.link}>Bekijk Kaart  ›</Text></Pressable>
      <Pressable onPress={p.onMap} style={s.map} accessibilityRole="button" accessibilityLabel="Kaart openen">
        <MiniMap/>
        <View style={s.pin}><View style={s.pinHead}>{p.ownOutfit ? <WardrobePortrait outfit={p.ownOutfit} size={44} selected/> : null}</View><View style={s.pinTip}/></View>
        <View style={s.locBox}><Text style={s.locTitle}>Avatar-locatie</Text><Text style={s.locSub}>{p.sharingLocation ? 'Wordt gedeeld met je vrienden' : 'Alleen voor jou (spookmodus)'}</Text></View>
        <View style={s.locBtn}><Ionicons name="navigate" size={20} color="#1E6B3A"/></View>
      </Pressable>
    </View>

    <View style={s.card2}>
      <Pressable onPress={p.onTimers} style={s.cardHead}><Text style={s.cardTitle}>Afteltimers</Text><Text style={s.link}>Bekijk alle  ›</Text></Pressable>
      {p.timers?.length ? <View style={{ gap: 8 }}>{p.timers.slice(0, 3).map(t => <Pressable key={t.id} onPress={p.onTimers} style={s.timer} accessibilityLabel={`${t.title}, ${t.label}`} testID={`profile-timer-${t.id}`}>
        <Text style={{ fontSize: 26 }}>{t.emoji}</Text><Text style={s.timerTitle} numberOfLines={1}>{t.title}</Text><Text style={s.timerLeft}>{t.label}</Text>
      </Pressable>)}</View> : <Pressable onPress={p.onTimers} style={{ alignItems: 'center', paddingVertical: 6 }}><View style={s.clock}><Ionicons name="time-outline" size={34} color="#C7C7CC"/></View><Text style={s.cardSub}>Nog geen timers</Text></Pressable>}
    </View>
    {p.footer}
  </ScrollView>;
}

/** Big yellow circle with a soft bust (used by profile + dev screen). */
export function YellowAvatarCircle({ children, size = 230 }: { children: React.ReactNode; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFE11A', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>{children}</View>;
}

function MiniMap() {
  return <Svg width="100%" height="100%" viewBox="0 0 600 150" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id="mmWater" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#5B8DB0"/><Stop offset="1" stopColor="#3F6F93"/></LinearGradient></Defs>
    <Rect width="600" height="150" fill="#C9CFC9"/>
    <Path d="M0 30 Q80 20 140 60 T300 70 Q380 60 420 110 L600 90" stroke="#8FB58A" strokeWidth="18" fill="none" opacity={0.55}/>
    <G stroke="#EEF1EE" strokeWidth="3">{Array.from({ length: 16 }, (_, i) => <Path key={`v${i}`} d={`M${i * 40 + 10} 0 L${i * 40 - 20} 150`}/>)}{Array.from({ length: 6 }, (_, i) => <Path key={`h${i}`} d={`M0 ${i * 28 + 8} L600 ${i * 28 + 18}`}/>)}</G>
    <Path d="M0 75 L600 60M120 0 L240 150M380 0 Q420 80 360 150" stroke="#FFF" strokeWidth="6" fill="none"/>
    <Path d="M360 150 Q420 95 470 110 Q520 70 600 80 L600 150 Z" fill="url(#mmWater)"/>
  </Svg>;
}

const s = StyleSheet.create({
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF14', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  timerTitle: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '700' },
  timerLeft: { color: '#FFE11A', fontSize: 14, fontWeight: '800' },
  root: { flex: 1, backgroundColor: '#0F2A1A' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  user: { color: '#FFF', fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  score: { color: '#C7C7CC', fontSize: 15, marginTop: 2 },
  heroWrap: { alignSelf: 'center', marginVertical: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#14301F', borderRadius: 14, borderWidth: 1, borderColor: '#24452F', padding: 16, marginBottom: 10 },
  card2: { backgroundColor: '#14301F', borderRadius: 14, borderWidth: 1, borderColor: '#24452F', padding: 16, marginBottom: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  cardSub: { color: '#C7C7CC', fontSize: 15, marginTop: 4 },
  link: { color: '#C7C7CC', fontSize: 15 },
  friendRow: { flexDirection: 'row', gap: 12 },
  friendCell: { borderRadius: 40 },
  map: { height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: '#C9CFC9' },
  pin: { position: 'absolute', left: '50%', top: 12, marginLeft: -26, alignItems: 'center' },
  pinHead: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFE11A', borderWidth: 3, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pinTip: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFE11A', marginTop: -2 },
  locBox: { position: 'absolute', left: 8, bottom: 8, backgroundColor: '#14301FEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  locTitle: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  locSub: { color: '#C7C7CC', fontSize: 12 },
  locBtn: { position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  clock: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: '#3A5A44', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
