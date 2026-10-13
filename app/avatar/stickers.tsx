/** Overview of the user's avatar stickers (roadmap step 8). Usable in the snap editor (Stickers) and chat (☺). */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { AvatarStickerArt } from '../../components/avatar/PosedAvatar';
import { useSession } from '../../hooks/useSession';
import { useOwnOutfit } from '../../hooks/useWardrobeSync';
import { DEFAULT_OUTFIT, type Outfit } from '../../lib/avatar/outfit';
import { AVATAR_STICKERS } from '../../lib/avatar/poses';
import { C } from '../../lib/theme';

export function AvatarStickerGallery({ outfit }: { outfit: Outfit | null }) {
  return <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.wrap}>
    <Stack.Screen options={{ title: 'Avatarstickers' }}/>
    <Text style={s.intro}>Je stickers dragen altijd je huidige outfit. Gebruik ze in de snap-editor onder Stickers of in een chat via ☺.</Text>
    {!outfit && <Text style={s.hint}>Je hebt nog geen outfit opgeslagen; dit is de standaardlook.</Text>}
    <View style={s.grid}>
      {AVATAR_STICKERS.map(st => <View key={st.id} style={s.cell}><AvatarStickerArt outfit={outfit ?? DEFAULT_OUTFIT} sticker={st} size={150}/></View>)}
    </View>
  </ScrollView>;
}

export default function AvatarStickersScreen() {
  const { session } = useSession();
  return <AvatarStickerGallery outfit={useOwnOutfit(session?.user.id)}/>;
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  intro: { color: C.text, fontSize: 15, marginBottom: 6 },
  hint: { color: C.muted, fontSize: 12, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 10 },
  cell: { width: '48%', alignItems: 'center', backgroundColor: C.surface, borderRadius: 18, paddingVertical: 10 },
});
