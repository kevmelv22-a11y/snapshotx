import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LensTilePreview } from './LensTilePreview';
import { LENS_TABS, demoViewCount, formatViewCount, lensesForTab, pickerLenses, searchLenses, type LensTab } from '../lib/lens-picker';
import { PHOTO_FILTERS, type PhotoFilter, type PhotoFilterId } from '../lib/photo-filters';

const LENSES = pickerLenses(PHOTO_FILTERS);
const COLUMNS = 4, GAP = 6, PAD = 8;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  selected: PhotoFilterId;
  favorites: PhotoFilterId[];
  recent: PhotoFilterId[];
  onSelect: (id: PhotoFilterId) => void;
  onToggleFavorite: (id: PhotoFilterId) => void;
  onClose: () => void;
};

/** Snapshot X lens browser: bottom sheet with tabs, search and a 4-column grid of lens tiles. */
export function LensPicker({ visible, selected, favorites, recent, onSelect, onToggleFavorite, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LensTab>('forYou');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [areaH, setAreaH] = useState(0);
  const tileW = Math.floor((width - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const tileH = Math.round(tileW * 1.55);
  const data = useMemo(() => (searching ? searchLenses(query, LENSES) : lensesForTab(tab, LENSES, { favorites, recent })), [searching, query, tab, favorites, recent]);
  if (!visible) return null;
  // Search is a transient mode: leaving the sheet (apply or close) always reopens on the tabs.
  const close = () => { setSearching(false); setQuery(''); onClose(); };
  const empty = searching ? `Geen lenzen gevonden voor “${query.trim()}”.`
    : tab === 'recent' ? 'Nog geen recente lenzen. Probeer er een uit “Voor jou”.'
      : tab === 'favorites' ? 'Nog geen favorieten. Houd een lens ingedrukt om hem toe te voegen.' : 'Geen lenzen.';
  const renderTile = ({ item }: { item: PhotoFilter }) => {
    const fav = favorites.includes(item.id);
    const active = item.id === selected;
    return <Pressable onPress={() => { setSearching(false); setQuery(''); onSelect(item.id); }} onLongPress={() => onToggleFavorite(item.id)} delayLongPress={350}
      accessibilityRole="button" accessibilityLabel={`Lens ${item.name}${active ? ', actief' : ''}${fav ? ', favoriet' : ''}`}
      accessibilityHint="Tik om toe te passen, houd ingedrukt voor favorieten"
      accessibilityActions={[{ name: 'longpress', label: fav ? 'Uit favorieten' : 'Aan favorieten' }]}
      onAccessibilityAction={() => onToggleFavorite(item.id)}
      style={[styles.tile, { width: tileW, height: tileH }, active && styles.tileActive]}>
      <LensTilePreview lens={item} width={tileW} height={tileH} />
      {fav && <View style={styles.star}><Ionicons name="star" size={10} color="white" /></View>}
      <View style={styles.views} accessibilityLabel="demo-aantal weergaven">
        <Ionicons name="eye-outline" size={12} color="white" />
        <Text style={styles.viewsText}>{formatViewCount(demoViewCount(item.id))}</Text>
      </View>
    </Pressable>;
  };
  // Keep the status bar and a strip of the camera visible above the lens sheet.
  const sheetH = Math.round(areaH > 0 ? areaH - Math.max(insets.top + 72, areaH * 0.16) : height * 0.72);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Achtergrond, sluit lenzen" />
    <View style={[styles.sheet, { height: sheetH }]}>
      <View style={styles.grabber} />
      {searching ? <View style={styles.header}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#AEAEB2" />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Zoek lenzen" placeholderTextColor="#8E8E93" style={styles.searchInput} returnKeyType="search" accessibilityLabel="Zoek lenzen" />
        </View>
        <Pressable onPress={() => { setSearching(false); setQuery(''); }} hitSlop={8} accessibilityLabel="Zoeken annuleren"><Text style={styles.cancel}>Annuleer</Text></Pressable>
      </View> : <View style={styles.header}>
        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Lenzen sluiten"><Ionicons name="chevron-down" size={30} color="white" /></Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flex: 1 }}>
          {LENS_TABS.map((t) => {
            const on = t.id === tab;
            return <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
              <Ionicons name={t.icon as IconName} size={24} color={on ? 'white' : '#8E8E93'} />
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>;
          })}
        </ScrollView>
        <Pressable onPress={() => setSearching(true)} hitSlop={10} accessibilityLabel="Lenzen zoeken"><Ionicons name="search" size={26} color="white" /></Pressable>
      </View>}
      <FlatList data={data} keyExtractor={(l) => l.id} numColumns={COLUMNS} renderItem={renderTile}
        columnWrapperStyle={{ gap: GAP }} contentContainerStyle={{ padding: PAD, gap: GAP, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled" extraData={selected}
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>} />
      <Pressable style={styles.edgeHandle} onPress={close} accessibilityLabel="Lenzen inklappen">
        <Ionicons name="chevron-forward" size={18} color="#D1D1D6" />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,28,32,0.95)', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(235,235,245,0.45)', marginTop: 8, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, minHeight: 56 },
  tabs: { gap: 6, paddingHorizontal: 2, alignItems: 'center' },
  tab: { alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  tabText: { color: '#8E8E93', fontSize: 12, fontWeight: '700' },
  tabTextOn: { color: 'white' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(118,118,128,0.3)', borderRadius: 12, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, color: 'white', fontSize: 16 },
  cancel: { color: 'white', fontSize: 15, fontWeight: '600' },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#2C2C30' },
  tileActive: { borderWidth: 2, borderColor: '#FFFC00' },
  star: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  views: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { color: 'white', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  empty: { color: '#AEAEB2', textAlign: 'center', padding: 32, fontSize: 14 },
  edgeHandle: { position: 'absolute', left: 0, top: '42%', width: 20, height: 60, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: 'rgba(72,72,78,0.85)', alignItems: 'center', justifyContent: 'center' },
});
