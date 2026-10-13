/** Chat: avatar sticker picker sheet + the sticker bubble content (roadmap step 8). */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../lib/theme';
import { DEFAULT_OUTFIT, type Outfit } from '../../lib/avatar/outfit';
import { AVATAR_STICKERS, type AvatarSticker } from '../../lib/avatar/poses';
import { AvatarStickerArt } from './PosedAvatar';

export function AvatarStickerSheet({ visible, outfit, onPick, onClose }: { visible: boolean; outfit: Outfit | null | undefined; onPick: (s: AvatarSticker) => void; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Sluiten"/>
    <View style={s.sheet}>
      <Text style={s.title}>Avatarstickers</Text>
      {!outfit && <Text style={s.hint}>Stel je avatar in de Avatarkast in om stickers met jouw look te sturen.</Text>}
      <View style={s.grid}>
        {AVATAR_STICKERS.map(st => <Pressable key={st.id} onPress={() => { onPick(st); onClose(); }} style={s.cell} accessibilityLabel={`Stuur avatarsticker ${st.caption}`}>
          <AvatarStickerArt outfit={outfit ?? DEFAULT_OUTFIT} sticker={st} size={76}/>
        </Pressable>)}
      </View>
    </View>
  </Modal>;
}

/** Bubble content for a `[avatar-sticker:id]` message, drawn with the sender's outfit. */
export function ChatAvatarSticker({ sticker, outfit }: { sticker: AvatarSticker; outfit: Outfit | null | undefined }) {
  return <AvatarStickerArt outfit={outfit ?? DEFAULT_OUTFIT} sticker={sticker} size={130}/>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  hint: { color: C.muted, fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cell: { width: '24%', alignItems: 'center' },
});
