/** Avatarkast "Pose" row (roadmap step 8): pick the profile pose; link to the avatar sticker overview. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Outfit } from '../../lib/avatar/outfit';
import { AVATAR_POSES, type PoseId } from '../../lib/avatar/poses';
import { PosedAvatar } from './PosedAvatar';

export function PosePicker({ outfit, value, onChange, showStickerLink = true }: { outfit: Outfit; value: PoseId; onChange: (p: PoseId) => void; showStickerLink?: boolean }) {
  return <View>
    <Text style={s.title}>Pose</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12, flexGrow: 0 }} contentContainerStyle={s.row}>
      {AVATAR_POSES.map(p => {
        const on = p.id === value;
        return <Pressable key={p.id} onPress={() => onChange(p.id)} style={[s.card, on && s.cardOn]} accessibilityRole="button" accessibilityLabel={`Pose ${p.label}`} accessibilityState={{ selected: on }}>
          <PosedAvatar outfit={outfit} pose={p.id} width={74} height={84} upper/>
          <Text style={[s.label, on && { color: '#FFF' }]} numberOfLines={1}>{p.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
    <Text style={s.hint}>Je pose staat in je profielheader en is de basis van je avatarstickers.</Text>
    {showStickerLink && <Pressable onPress={() => router.push('/avatar/stickers')} style={s.link} accessibilityRole="link" accessibilityLabel="Avatarstickers bekijken">
      <Text style={s.linkText}>☺  Avatarstickers bekijken</Text><Text style={s.linkText}>›</Text>
    </Pressable>}
  </View>;
}

const s = StyleSheet.create({
  title: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 6, marginBottom: 8 },
  row: { paddingHorizontal: 12, gap: 8, paddingBottom: 6 },
  card: { width: 82, borderRadius: 14, backgroundColor: '#2A2A2E', alignItems: 'center', paddingTop: 4, paddingBottom: 6, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: '#34C759', backgroundColor: '#1F3A28' },
  label: { color: '#AEAEB2', fontSize: 11, fontWeight: '700', marginTop: 2 },
  hint: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  link: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2A2A2E', borderRadius: 14, padding: 14, marginTop: 10, marginBottom: 6 },
  linkText: { color: '#FFF', fontWeight: '800' },
});
