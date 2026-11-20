/** Chat: avatar sticker picker sheet + the sticker bubble content (roadmap step 8). */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../lib/theme';
import { defaultOutfitFor, type Outfit } from '../../lib/avatar/outfit';
import { useWardrobe } from '../../stores/wardrobe';
import { AVATAR_STICKERS, DUO_STICKERS, type AvatarSticker, type DuoSticker } from '../../lib/avatar/poses';
import { AvatarStickerArt, DuoStickerArt } from './PosedAvatar';

/** `friendOutfit` (1-on-1 chats) adds the "Samen" tab with duo stickers (Snapchat Friendmoji). */
export function AvatarStickerSheet({ visible, outfit, friendOutfit, friendName, onPick, onPickDuo, onClose }: { visible: boolean; outfit: Outfit | null | undefined; friendOutfit?: Outfit | null; friendName?: string; onPick: (s: AvatarSticker) => void; onPickDuo?: (s: DuoSticker) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'solo' | 'duo'>('solo');
  const duo = !!onPickDuo && friendOutfit !== undefined;
  const mine = outfit ?? defaultOutfitFor(useWardrobe.getState().gender);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Sluiten"/>
    <View style={s.sheet}>
      <Text style={s.title}>Avatarstickers</Text>
      {duo && <View style={s.tabs}>
        {(['solo', 'duo'] as const).map(t => <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]} testID={`sticker-tab-${t}`} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
          <Text style={[s.tabText, tab === t && s.tabTextOn]}>{t === 'solo' ? 'Ik' : `Samen${friendName ? ` met ${friendName}` : ''}`}</Text>
        </Pressable>)}
      </View>}
      {!outfit && <Text style={s.hint}>Stel je avatar in de Avatarkast in om stickers met jouw look te sturen.</Text>}
      {duo && tab === 'duo' ? <View style={s.grid}>
        {DUO_STICKERS.map(st => <Pressable key={st.id} onPress={() => { onPickDuo!(st); onClose(); }} style={s.duoCell} accessibilityLabel={`Stuur duosticker ${st.caption}`}>
          <DuoStickerArt me={mine} friend={friendOutfit ?? defaultOutfitFor('male')} sticker={st} size={86}/>
        </Pressable>)}
      </View> : <View style={s.grid}>
        {AVATAR_STICKERS.map(st => <Pressable key={st.id} onPress={() => { onPick(st); onClose(); }} style={s.cell} accessibilityLabel={`Stuur avatarsticker ${st.caption}`}>
          <AvatarStickerArt outfit={mine} sticker={st} size={76}/>
        </Pressable>)}
      </View>}
    </View>
  </Modal>;
}

/** Bubble content for a `[duo-sticker:id]` message: sender + the other person of the 1-on-1 chat. */
export function ChatDuoSticker({ sticker, sender, partner }: { sticker: DuoSticker; sender: Outfit | null | undefined; partner: Outfit | null | undefined }) {
  return <DuoStickerArt me={sender ?? defaultOutfitFor(useWardrobe.getState().gender)} friend={partner ?? defaultOutfitFor('male')} sticker={sticker} size={130}/>;
}

/** Bubble content for a `[avatar-sticker:id]` message, drawn with the sender's outfit. */
export function ChatAvatarSticker({ sticker, outfit }: { sticker: AvatarSticker; outfit: Outfit | null | undefined }) {
  return <AvatarStickerArt outfit={outfit ?? defaultOutfitFor(useWardrobe.getState().gender)} sticker={sticker} size={130}/>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  hint: { color: C.muted, fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cell: { width: '24%', alignItems: 'center' },
  duoCell: { width: '32%', alignItems: 'center' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFFFFF14' },
  tabOn: { backgroundColor: C.yellow },
  tabText: { color: C.text, fontWeight: '800' },
  tabTextOn: { color: '#111' },
});
