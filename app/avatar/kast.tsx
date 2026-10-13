/**
 * Avatar-kast: avatar wardrobe editor. Saved locally first (AsyncStorage via stores/wardrobe), then
 * best-effort synced to the account (sx_avatar_outfits; silently local-only when unavailable).
 * Paid items use a MOCK purchase that only unlocks the item: no payment is ever made.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FigureArt, HeadPreviewArt, ItemPreviewArt } from '../../components/avatar/AvatarArt';
import { CategoryIcon } from '../../components/avatar/WardrobeIcons';
import { REACTIONS, type Reaction } from '../../components/avatar/WardrobeAvatar';
import { OutfitArt, outfitArtId } from '../../components/avatar/OutfitArt';
import { ITEM_ART } from '../../components/avatar/itemArt';
import { useSession } from '../../hooks/useSession';
import { useWardrobeSync } from '../../hooks/useWardrobeSync';
import {
  CATEGORIES, DEFAULT_HAIR, DEFAULT_OUTFIT, DEFAULT_SKIN, HAIR_STYLES, applyLook, formatPriceCents, isFree, isOwned, itemsForTab, recolor, removeLayer, unownedItems, wearItem,
  type CategoryTab, type HairStyle, type Layer, type Outfit, type OutfitHistory, type SortMode, type WardrobeCategory, type WardrobeItem,
} from '../../lib/avatar/outfit';
import {
  CATEGORY_TABS, CHIP_CATEGORIES, CURATED_LOOKS, HAIR_STYLE_LABELS, ITEMS_BY_ID, SKIN_SWATCHES, WARDROBE_ITEMS, swatchesFor, type CuratedLook,
} from '../../lib/avatar/wardrobeItems';
import { useWardrobe } from '../../stores/wardrobe';
import { useAvatarPose } from '../../stores/avatarPose';
import { PosePicker } from '../../components/avatar/PosePicker';

type SheetTab = 'mode' | 'kast' | 'avatar';
type ModeFilter = 'featured' | 'premium';
/** Previewed paid item(s) awaiting a (mock) purchase; `before` restores the outfit on dismiss. */
type Pending = { items: WardrobeItem[]; title: string; label: string; before: OutfitHistory };

const native = Platform.OS !== 'web';
const GREEN = '#34C759';
const BLUE = '#0A7CFF';
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
const priceText = (cents: number) => formatPriceCents(cents).replace(' ', '\u00A0');
const totalCents = (items: WardrobeItem[]) => items.reduce((sum, i) => sum + (i.priceCents ?? 0), 0);
const LOOK_ITEMS = new Map(CURATED_LOOKS.map(l => [l.id, Object.values(l.items).map(id => ITEMS_BY_ID.get(id!)!).filter(Boolean)]));
const LOOK_OUTFITS = new Map<string, Outfit>(CURATED_LOOKS.map(l => [l.id, applyLook(DEFAULT_OUTFIT, l.items)]));
const lookMatches = (outfit: Outfit, look: CuratedLook) => CATEGORIES.every(c => outfit[c] === (look.items[c] ?? null));

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, 520);
  const history = useWardrobe(s => s.history);
  const unlocked = useWardrobe(s => s.unlocked);
  const outfit = history.present;
  const [ready, setReady] = useState(() => useWardrobe.persist.hasHydrated());
  const [tab, setTab] = useState<SheetTab>('kast');
  const [category, setCategory] = useState<CategoryTab>('top');
  const [lastLayer, setLastLayer] = useState<WardrobeCategory | null>(null);
  const [sort, setSort] = useState<SortMode>('default');
  const [onlyFree, setOnlyFree] = useState(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('featured');
  const [pending, setPending] = useState<Pending | null>(null);
  const [saveCheck, setSaveCheck] = useState<WardrobeItem[] | null>(null);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const reactionIndex = useRef(0);
  const closing = useRef(false);

  // Restore the saved outfit once AsyncStorage has hydrated, then reconcile with the account copy.
  useEffect(() => {
    const start = () => { useWardrobe.getState().begin(); setReady(true); };
    if (useWardrobe.persist.hasHydrated()) { start(); return; }
    return useWardrobe.persist.onFinishHydration(start);
  }, []);
  useWardrobeSync(uid, { force: true });

  const sheetH = Math.round(winH * 0.49);
  const stageH = winH - sheetH;
  const avatarW = Math.min(180, Math.max(130, (stageH - insets.top - 40) / 1.85));
  const avatarScale = 0.82 + zoom * 0.36;

  const activeLayer: Layer | null = tab === 'avatar' ? 'hair' : tab === 'mode' || category === 'featured' || category === 'all' ? lastLayer : category;
  const activeItem = activeLayer && activeLayer !== 'hair' ? (outfit[activeLayer] ? ITEMS_BY_ID.get(outfit[activeLayer]!) : undefined) : undefined;
  // The Avatar tab has its own hair/skin rows, so the side strip only serves clothing layers.
  // Clothing colour swatches are hidden: the preview is pre-rendered art that cannot be recoloured, so a swatch
  // would change nothing visible (and the art cards would lie about the colour). Hair/skin stay in the Avatar tab.
  const swatches: string[] = [];
  void swatchesFor;
  const activeColor = activeLayer === 'hair' ? (outfit.colors.hair ?? DEFAULT_HAIR) : activeItem ? (outfit.colors[activeItem.category] ?? activeItem.colors[0]) : null;

  const data = useMemo(() => itemsForTab(WARDROBE_ITEMS, category, { onlyFree, sort }), [category, onlyFree, sort]);
  const modeData = useMemo(() => modeFilter === 'featured'
    ? WARDROBE_ITEMS.filter(i => i.featured)
    : WARDROBE_ITEMS.filter(i => !isFree(i)).sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0)), [modeFilter]);

  const showChips = tab === 'kast' && CHIP_CATEGORIES.includes(category);
  const chipLayer = category as WardrobeCategory;

  const react = useCallback(() => {
    const kind = REACTIONS[reactionIndex.current % REACTIONS.length];
    reactionIndex.current += 1;
    setReaction({ kind, key: Date.now() });
  }, []);

  /** Applies a change as a preview; unowned paid items open the (mock) purchase sheet. */
  const preview = useCallback((change: (o: Outfit) => Outfit, toBuy: (next: Outfit, owned: string[]) => WardrobeItem[], title: string, label: (items: WardrobeItem[]) => string) => {
    const store = useWardrobe.getState();
    if (pending) store.restore(pending.before);
    const base = useWardrobe.getState().history;
    const next = change(base.present);
    store.apply(next);
    react();
    const items = toBuy(next, store.unlocked);
    setPending(items.length ? { items, title, label: label(items), before: base } : null);
  }, [pending, react]);

  const onItem = useCallback((item: WardrobeItem) => {
    setLastLayer(item.category);
    preview(o => wearItem(o, item), (_n, owned) => isOwned(item, owned) ? [] : [item], 'Item kopen', () => item.name);
  }, [preview]);

  const onLook = useCallback((look: CuratedLook) => {
    setLastLayer(null);
    preview(o => applyLook(o, look.items), (next, owned) => unownedItems(next, WARDROBE_ITEMS, owned), 'Look kopen', items => `${look.name} (${items.length} ${items.length === 1 ? 'item' : 'items'})`);
  }, [preview]);

  const dismissPurchase = () => { if (pending) useWardrobe.getState().restore(pending.before); setPending(null); };
  const buy = () => {
    if (!pending) return;
    useWardrobe.getState().unlock(pending.items.map(i => i.id));
    setToast({ text: pending.items.length === 1 ? `${pending.items[0].name} ontgrendeld` : `${pending.items.length} items ontgrendeld` });
    setPending(null);
    react();
  };
  const applyBody = (next: Outfit) => { setPending(null); useWardrobe.getState().apply(next); };
  const onSwatch = (color: string) => {
    if (!activeLayer) return;
    if (activeLayer !== 'hair' && !outfit[activeLayer]) return;
    useWardrobe.getState().apply(recolor(outfit, activeLayer, color));
  };
  const onUndo = () => { setPending(null); useWardrobe.getState().undo(); };
  const onRedo = () => { setPending(null); useWardrobe.getState().redo(); };
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile'); };
  const commitSave = (opts: { buyFirst?: WardrobeItem[] } = {}) => {
    if (closing.current) return;
    closing.current = true;
    if (opts.buyFirst?.length) useWardrobe.getState().unlock(opts.buyFirst.map(i => i.id)); // MOCK unlock, no payment
    const { dropped } = useWardrobe.getState().save(uid);
    setPending(null);
    setSaveCheck(null);
    setToast(dropped.length ? { text: 'Niet-gekochte items zijn niet opgeslagen', warn: true } : { text: 'Outfit opgeslagen' });
    setTimeout(close, dropped.length ? 1900 : 1100);
  };
  const save = () => {
    if (closing.current) return;
    const unowned = unownedItems(useWardrobe.getState().history.present, WARDROBE_ITEMS, useWardrobe.getState().unlocked);
    if (unowned.length) { setPending(null); setSaveCheck(unowned); return; }
    commitSave();
  };

  useEffect(() => { if (!toast || closing.current) return; const id = setTimeout(() => setToast(null), 1600); return () => clearTimeout(id); }, [toast]);

  const cardOuter = (W - 24 - 16) / 3;
  const cardH = Math.round(cardOuter * 1.2);
  const renderCard = ({ item }: { item: WardrobeItem }) => { const selected = outfit[item.category] === item.id; return <ItemCard item={item} width={cardOuter} height={cardH} selected={selected} color={selected ? outfit.colors[item.category] : undefined} owned={isOwned(item, unlocked)} onPress={onItem}/>; };
  const bottomPad = insets.bottom + (pending ? 150 : 40);

  return <View style={s.root}>
    <StatusBar style="light"/>
    <StageBackground width={winW} height={stageH + 40}/>

    {/* avatar */}
    <View style={[s.avatarWrap, { top: stageH - 26 - avatarW * 2 * 0.885, left: (winW - avatarW) / 2, transform: [{ scale: avatarScale }] }]} pointerEvents="none">
      {/* ChatGPT-style art only: the exact look image, else the closest look (lib/avatar/avatarArt nearestLookArt). */}
      {ready && <View style={{ width: avatarW, height: avatarW * 2 * 0.885 + 10, justifyContent: 'flex-end' }} testID={`kast-preview-art:${outfitArtId(outfit)}`}>
        <OutfitArt outfit={outfit} width={avatarW} height={avatarW * 2 * 0.885}/>
        <View style={s.artShadow}/>
      </View>}
    </View>

    {/* top bar */}
    <View style={[s.topBar, { top: insets.top + 8 }]}>
      <Pressable onPress={close} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Sluiten" hitSlop={8}><Ionicons name="close" size={26} color="#FFF"/></Pressable>
      <Pressable onPress={save} style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Opslaan"><Text style={s.saveText}>Opslaan</Text></Pressable>
    </View>

    {/* colour strip */}
    <View style={[s.strip, { top: insets.top + 62, maxHeight: stageH - insets.top - 130 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.stripContent}>
        {swatches.map(color => {
          const active = activeColor?.toUpperCase() === color.toUpperCase();
          return <Pressable key={color} onPress={() => onSwatch(color)} accessibilityRole="button" accessibilityLabel={`Kleur ${color}`} style={[s.swatchRing, active && s.swatchRingActive]}>
            <View style={[s.swatch, { backgroundColor: color }]}/>
          </Pressable>;
        })}
        <Pressable onPress={() => setTab('avatar')} style={s.gear} accessibilityRole="button" accessibilityLabel="Avatarinstellingen"><Ionicons name="settings-sharp" size={25} color="#FFF"/></Pressable>
      </ScrollView>
    </View>

    {/* zoom slider */}
    <ZoomSlider value={zoom} onChange={setZoom} style={{ top: insets.top + (stageH - insets.top) * 0.36 }}/>

    {/* undo / redo */}
    <View style={[s.history, { top: stageH - 74 }]}>
      <Pressable onPress={onUndo} disabled={!history.past.length} style={s.historyBtn} accessibilityRole="button" accessibilityLabel="Ongedaan maken"><MaterialCommunityIcons name="undo-variant" size={23} color={history.past.length ? '#FFF' : '#6C6C70'}/></Pressable>
      <Pressable onPress={onRedo} disabled={!history.future.length} style={s.historyBtn} accessibilityRole="button" accessibilityLabel="Opnieuw"><MaterialCommunityIcons name="redo-variant" size={23} color={history.future.length ? '#FFF' : '#6C6C70'}/></Pressable>
    </View>

    {/* wardrobe sheet */}
    <View style={[s.sheet, { height: sheetH + 20, top: stageH - 20 }]}>
      <View style={s.handle}/>
      <View style={s.tabs}>
        {([['mode', 'Mode'], ['kast', 'Kast'], ['avatar', 'Avatar']] as const).map(([id, label]) => {
          const active = tab === id;
          const color = active ? '#FFF' : '#8E8E93';
          return <Pressable key={id} onPress={() => { setTab(id); setPending(p => { if (p) useWardrobe.getState().restore(p.before); return null; }); }} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            {id === 'mode' ? <MaterialCommunityIcons name="hanger" size={26} color={color}/> : id === 'kast' ? <Ionicons name={active ? 'heart' : 'heart-outline'} size={24} color={color}/> : <Ionicons name="person-circle-outline" size={25} color={color}/>}
            <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
            <View style={[s.tabDot, !active && { opacity: 0 }]}/>
          </Pressable>;
        })}
      </View>

      {tab === 'kast' && <View style={s.catRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORY_TABS.map(c => {
            const active = c.tab === category;
            return <Pressable key={c.tab} onPress={() => { setCategory(c.tab); setPending(p => { if (p) useWardrobe.getState().restore(p.before); return null; }); }} style={s.cat} accessibilityRole="tab" accessibilityLabel={c.label} accessibilityState={{ selected: active }}>
              <CategoryIcon tab={c.tab} color={active ? '#FFF' : '#6C6C70'}/>
              <View style={[s.catLine, !active && { opacity: 0 }]}/>
            </Pressable>;
          })}
        </ScrollView>
      </View>}

      {showChips && <View style={s.chips}>
        <Chip label="Deselecteren" disabled={!outfit[chipLayer]} onPress={() => { setPending(null); useWardrobe.getState().apply(removeLayer(useWardrobe.getState().history.present, chipLayer)); }}/>
        <Chip label={sort === 'default' ? 'Sorteren' : sort === 'price' ? 'Op prijs' : 'Op naam'} active={sort !== 'default'} icon="swap-vertical" onPress={() => setSort(v => v === 'default' ? 'price' : v === 'price' ? 'name' : 'default')}/>
        <Chip label={onlyFree ? 'Alleen gratis' : 'Filter'} active={onlyFree} icon="options-outline" onPress={() => setOnlyFree(v => !v)}/>
      </View>}

      {tab === 'avatar' ? <AvatarPanel outfit={outfit} bottomPad={insets.bottom + 40} onApply={applyBody}/>
        : tab === 'mode' ? <FlatList
          key={`mode-${modeFilter}`}
          data={modeData}
          keyExtractor={i => i.id}
          numColumns={3}
          style={{ flex: 1 }}
          contentContainerStyle={[s.grid, { paddingBottom: bottomPad }]}
          columnWrapperStyle={{ gap: 8 }}
          initialNumToRender={9}
          windowSize={5}
          removeClippedSubviews={native}
          ListHeaderComponent={<ModeHeader outfit={outfit} unlocked={unlocked} filter={modeFilter} onFilter={f => setModeFilter(f)} onLook={onLook}/>}
          ListEmptyComponent={<Text style={s.empty}>Geen items gevonden.</Text>}
          renderItem={renderCard}
        />
        : <FlatList
          key={`kast-${category}-${sort}-${onlyFree}`}
          data={data}
          keyExtractor={i => i.id}
          numColumns={3}
          style={{ flex: 1 }}
          contentContainerStyle={[s.grid, { paddingBottom: bottomPad }]}
          columnWrapperStyle={{ gap: 8 }}
          initialNumToRender={12}
          windowSize={5}
          removeClippedSubviews={native}
          ListEmptyComponent={<Text style={s.empty}>Geen items gevonden.</Text>}
          renderItem={renderCard}
        />}
    </View>

    <PurchaseSheet pending={pending} bottomInset={insets.bottom} onBuy={buy} onDismiss={dismissPurchase}/>
    {saveCheck && <SaveCheckSheet items={saveCheck} bottomInset={insets.bottom} onBuyAndSave={() => commitSave({ buyFirst: saveCheck })} onSaveWithout={() => commitSave()} onCancel={() => setSaveCheck(null)}/>}
    {!!toast && <View style={[s.toast, { top: stageH - 64 }]} pointerEvents="none"><Ionicons name={toast.warn ? 'information-circle' : 'checkmark-circle'} size={18} color={toast.warn ? '#FF9F0A' : GREEN}/><Text style={s.toastText}>{toast.text}</Text></View>}
  </View>;
}

function StageBackground({ width, height }: { width: number; height: number }) {
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
    <Defs>
      <RadialGradient id="kastStage" cx="50%" cy="40%" r="75%"><Stop offset="0" stopColor="#38383B"/><Stop offset="0.38" stopColor="#2C2C2E"/><Stop offset="0.75" stopColor="#141415"/><Stop offset="1" stopColor="#000"/></RadialGradient>
      <RadialGradient id="kastFloor" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#4A4A4E" stopOpacity={0.55}/><Stop offset="1" stopColor="#2C2C2E" stopOpacity={0}/></RadialGradient>
    </Defs>
    <Rect width={width} height={height} fill="url(#kastStage)"/>
    <Ellipse cx={width / 2} cy={height * 0.86} rx={width * 0.62} ry={height * 0.16} fill="url(#kastFloor)"/>
  </Svg>;
}

function ZoomSlider({ value, onChange, style }: { value: number; onChange: (update: (v: number) => number) => void; style: object }) {
  const TRACK = 74, KNOB = 24, RANGE = TRACK - KNOB - 6;
  const lastY = useRef(0);
  return <View style={[s.slider, style]} accessibilityRole="adjustable" accessibilityLabel="Zoomen"
    onStartShouldSetResponder={() => true}
    onMoveShouldSetResponder={() => true}
    onResponderGrant={e => { lastY.current = e.nativeEvent.pageY; }}
    onResponderMove={e => { const dy = e.nativeEvent.pageY - lastY.current; lastY.current = e.nativeEvent.pageY; onChange(v => Math.max(0, Math.min(1, v - dy / RANGE))); }}>
    <View style={[s.sliderKnob, { top: 3 + (1 - value) * RANGE }]}/>
  </View>;
}

function Chip({ label, onPress, icon, disabled, active }: { label: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name']; disabled?: boolean; active?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[s.chip, active && s.chipActive, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityState={{ disabled, selected: active }}>
    <Text style={s.chipText}>{label}</Text>{icon && <Ionicons name={icon} size={15} color={GREEN}/>}
  </Pressable>;
}

const ItemCard = React.memo(function ItemCard({ item, width, height, selected, color, owned, onPress }: { item: WardrobeItem; width: number; height: number; selected: boolean; color?: string; owned: boolean; onPress: (i: WardrobeItem) => void }) {
  const inner = width - 6;
  const imgH = height - 6 - 28;
  return <Pressable onPress={() => onPress(item)} style={[s.cardRing, { width, height }, selected && { borderColor: BLUE }]} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.brand}${item.priceCents && !owned ? `, ${formatPriceCents(item.priceCents)}` : ''}`}>
    <View style={s.card}>
      <View style={{ width: inner, height: imgH }}>
        <CardGlow width={inner} height={imgH}/>
        <ItemThumb item={item} color={color} width={inner} height={imgH}/>
        {!owned && <View style={s.euro}><Text style={s.euroText}>€</Text></View>}
      </View>
      <BrandLabel brand={item.brand}/>
    </View>
  </Pressable>;
});

function CardGlow({ width, height }: { width: number; height: number }) {
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
    <Defs><RadialGradient id="cardGlow" cx="50%" cy="38%" r="70%"><Stop offset="0" stopColor="#3A3A3D"/><Stop offset="1" stopColor="#1C1C1E"/></RadialGradient></Defs>
    <Rect width={width} height={height} fill="url(#cardGlow)"/>
  </Svg>;
}

const BRAND_STYLE: Record<string, object> = {
  'Basisbes': { fontWeight: '900', letterSpacing: -0.2 },
  'Strideon': { fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5 },
  'Ploeg & Co': { fontWeight: '800', letterSpacing: 0.2 },
  'CLUB VELDE': { fontFamily: SERIF, fontWeight: '700', letterSpacing: 1.2, fontSize: 10 },
  'AURELIO': { fontFamily: SERIF, letterSpacing: 2.4, fontSize: 12 },
  'BALDERO': { fontWeight: '800', letterSpacing: 1, fontSize: 9.5 },
  'LINDEHOF': { fontFamily: SERIF, fontWeight: '700', letterSpacing: 2.2 },
  'trivo': { fontWeight: '800', letterSpacing: 0.3 },
  'PIXELWEAR': { fontWeight: '900', letterSpacing: 1.6 },
  'LUNE LUNE': { fontWeight: '600', letterSpacing: 2.6 },
  'Sterrenzaal': { fontFamily: SERIF, fontStyle: 'italic', letterSpacing: 0.3 },
  'MAISON ORLÉ': { fontWeight: '600', letterSpacing: 1.8, fontSize: 10.5 },
  'ROSSANO': { fontFamily: SERIF, fontWeight: '800', letterSpacing: 2.2 },
  'WOLKJE': { fontFamily: SERIF, fontWeight: '900', letterSpacing: 1.4, fontSize: 13 },
  'klompz': { fontWeight: '900', fontStyle: 'italic' },
  'Festive Fashion': { fontFamily: SERIF, fontStyle: 'italic' },
  'FLITS CREW': { fontWeight: '900', letterSpacing: 0.4, fontSize: 10 },
  'VERLENGING': { fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.8 },
};

function BrandLabel({ brand }: { brand: string }) {
  if (brand === 'Kast Studio') return <Text style={s.brand} numberOfLines={1}>Kast <Text style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: '700' }}>Studio</Text></Text>;
  return <Text style={[s.brand, BRAND_STYLE[brand]]} numberOfLines={1}>{brand}</Text>;
}

function ModeHeader({ outfit, unlocked, filter, onFilter, onLook }: { outfit: Outfit; unlocked: string[]; filter: ModeFilter; onFilter: (f: ModeFilter) => void; onLook: (l: CuratedLook) => void }) {
  return <View style={s.modeHeader}>
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>Complete looks</Text>
      <Text style={s.sectionSub}>Tik op een look om de hele outfit te passen</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.looksScroll} contentContainerStyle={s.looksRow}>
      {CURATED_LOOKS.map(look => <LookCard key={look.id} look={look} selected={lookMatches(outfit, look)} unlocked={unlocked} onPress={onLook}/>)}
    </ScrollView>
    <View style={[s.sectionHead, { marginTop: 14 }]}>
      <Text style={s.sectionTitle}>Uitgelicht en nieuw</Text>
    </View>
    <View style={s.segment} accessibilityRole="tablist">
      {([['featured', 'Uitgelicht', 'sparkles'], ['premium', 'Premium', 'diamond-outline']] as const).map(([id, label, icon]) => {
        const active = filter === id;
        return <Pressable key={id} onPress={() => onFilter(id)} style={[s.segmentBtn, active && s.segmentBtnActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
          <Ionicons name={icon} size={14} color={active ? '#000' : '#FFF'}/><Text style={[s.segmentText, active && s.segmentTextActive]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

/** Item tile image: the ChatGPT-style thumbnail (components/avatar/itemArt) when there is one, else the old render.
 *  The art can't be recoloured, so a recolour of an art-backed item still shows the original colour. */
function ItemThumb({ item, color, width, height }: { item: WardrobeItem; color?: string; width: number; height: number }) {
  const src = ITEM_ART[item.id];
  if (!src) return <ItemPreviewArt item={item} color={color} width={width} height={height}/>;
  const side = Math.min(width, height);
  return <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }} testID={`item-art:${item.id}`}>
    <Image source={src} style={{ width: side, height: side }} resizeMode="contain" accessibilityIgnoresInvertColors/>
  </View>;
}

const LOOK_W = 116, LOOK_IMG = 138;
const LookCard = React.memo(function LookCard({ look, selected, unlocked, onPress }: { look: CuratedLook; selected: boolean; unlocked: string[]; onPress: (l: CuratedLook) => void }) {
  const items = LOOK_ITEMS.get(look.id) ?? [];
  const toBuy = items.filter(i => !isOwned(i, unlocked));
  const meta = toBuy.length ? priceText(totalCents(toBuy)) : items.some(i => !isFree(i)) ? 'In bezit' : 'Gratis';
  return <Pressable onPress={() => onPress(look)} style={[s.lookRing, selected && { borderColor: BLUE }]} accessibilityRole="button" accessibilityLabel={`Look ${look.name}: ${look.tagline}. ${items.length} items, ${meta}`}>
    <View style={s.lookCard}>
      <View style={{ width: LOOK_W - 5, height: LOOK_IMG }}>
        <CardGlow width={LOOK_W - 5} height={LOOK_IMG}/>
        <OutfitArt outfit={{ ...LOOK_OUTFITS.get(look.id)!, gender: useWardrobe.getState().gender }} width={LOOK_W - 5} height={LOOK_IMG - 6}/>
        {toBuy.length > 0 && <View style={s.euro}><Text style={s.euroText}>€</Text></View>}
      </View>
      <View style={s.lookText}>
        <Text style={s.lookName} numberOfLines={1}>{look.name}</Text>
        <Text style={s.lookMeta} numberOfLines={1}>{items.length} items · <Text style={toBuy.length ? s.lookPrice : undefined}>{meta}</Text></Text>
      </View>
    </View>
  </Pressable>;
});

function AvatarPanel({ outfit, bottomPad, onApply }: { outfit: Outfit; bottomPad: number; onApply: (next: Outfit) => void }) {
  const hair = outfit.colors.hair ?? null;
  const skin = (outfit.colors.skin ?? DEFAULT_SKIN).toUpperCase();
  const setHairColor = (color: string | null) => {
    const colors = { ...outfit.colors };
    if (color) colors.hair = color; else delete colors.hair;
    onApply({ ...outfit, colors });
  };
  const pose = useAvatarPose(st => st.pose);
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.avatarPanel, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
    <PosePicker outfit={outfit} value={pose} onChange={useAvatarPose.getState().setPose}/>
    <Text style={s.panelTitle}>Kapsel</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.looksScroll} contentContainerStyle={s.looksRow}>
      {HAIR_STYLES.map(style => <HairCard key={style} style={style} outfit={outfit} selected={outfit.hairStyle === style} onPress={() => onApply({ ...outfit, hairStyle: style })}/>)}
    </ScrollView>

    <Text style={s.panelTitle}>Haarkleur</Text>
    <View style={s.swatchRow}>
      <Pressable onPress={() => setHairColor(null)} style={[s.bigSwatchRing, !hair && s.bigSwatchRingActive]} accessibilityRole="button" accessibilityLabel="Standaard haarkleur met blonde punten" accessibilityState={{ selected: !hair }}>
        <View style={[s.bigSwatch, { backgroundColor: DEFAULT_HAIR, overflow: 'hidden' }]}><View style={s.tipsHalf}/></View>
      </Pressable>
      {swatchesFor('hair').map(color => {
        const active = hair?.toUpperCase() === color.toUpperCase();
        return <Pressable key={color} onPress={() => setHairColor(color)} style={[s.bigSwatchRing, active && s.bigSwatchRingActive]} accessibilityRole="button" accessibilityLabel={`Haarkleur ${color}`} accessibilityState={{ selected: active }}>
          <View style={[s.bigSwatch, { backgroundColor: color }]}/>
        </Pressable>;
      })}
    </View>
    <Text style={s.panelHint}>De eerste kleur is je standaard krullen met blonde punten.</Text>

    <Text style={s.panelTitle}>Huidskleur</Text>
    <View style={s.swatchRow}>
      {SKIN_SWATCHES.map(color => {
        const active = skin === color.toUpperCase();
        return <Pressable key={color} onPress={() => onApply(recolor(outfit, 'skin', color))} style={[s.bigSwatchRing, active && s.bigSwatchRingActive]} accessibilityRole="button" accessibilityLabel={`Huidskleur ${color}`} accessibilityState={{ selected: active }}>
          <View style={[s.bigSwatch, { backgroundColor: color }]}/>
        </Pressable>;
      })}
    </View>

    <Pressable onPress={() => router.push('/avatar-editor')} style={({ pressed }) => [s.editorLink, pressed && { opacity: 0.8 }]} accessibilityRole="link" accessibilityLabel="Klassieke avatar-editor openen">
      <View style={s.editorIcon}><Ionicons name="color-wand-outline" size={20} color="#FFF"/></View>
      <View style={{ flex: 1 }}>
        <Text style={s.editorTitle}>Klassieke avatar-editor</Text>
        <Text style={s.editorSub}>Gezicht, kapsel en kleding van je Snapshot X-avatar</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8E8E93"/>
    </Pressable>
  </ScrollView>;
}

const HAIR_W = 82, HAIR_IMG = 84;
const HairCard = React.memo(function HairCard({ style, outfit, selected, onPress }: { style: HairStyle; outfit: Outfit; selected: boolean; onPress: () => void }) {
  const preview = useMemo(() => ({ ...outfit, hairStyle: style }), [outfit, style]);
  return <Pressable onPress={onPress} style={[s.lookRing, { width: HAIR_W }, selected && { borderColor: BLUE }]} accessibilityRole="button" accessibilityLabel={`Kapsel ${HAIR_STYLE_LABELS[style]}`} accessibilityState={{ selected }}>
    <View style={s.lookCard}>
      <View style={{ width: HAIR_W - 5, height: HAIR_IMG }}>
        <CardGlow width={HAIR_W - 5} height={HAIR_IMG}/>
        <HeadPreviewArt outfit={preview} width={HAIR_W - 5} height={HAIR_IMG}/>
      </View>
      <Text style={s.hairLabel} numberOfLines={1}>{HAIR_STYLE_LABELS[style]}</Text>
    </View>
  </Pressable>;
});

function PurchaseSheet({ pending, bottomInset, onBuy, onDismiss }: { pending: Pending | null; bottomInset: number; onBuy: () => void; onDismiss: () => void }) {
  const [y] = useState(() => new Animated.Value(220));
  const [shown, setShown] = useState<Pending | null>(pending);
  if (pending && pending !== shown) setShown(pending);
  useEffect(() => {
    Animated.timing(y, { toValue: pending ? 0 : 220, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start(({ finished }) => { if (finished && !pending) setShown(null); });
  }, [pending, y]);
  if (!shown) return null;
  const total = totalCents(shown.items);
  return <Animated.View style={[s.buySheet, { paddingBottom: bottomInset + 16, transform: [{ translateY: y }] }]} accessibilityViewIsModal>
    <View style={s.buyHandle}/>
    <View style={s.buyRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.buyTitle}>{shown.title}</Text>
        <Text style={s.buySub} numberOfLines={2}>{shown.label} · <Text style={s.buyPrice}>{priceText(total)}</Text></Text>
      </View>
      <Pressable onPress={onBuy} style={({ pressed }) => [s.buyBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Kopen voor ${formatPriceCents(total)}`}><Text style={s.buyBtnText}>Kopen</Text></Pressable>
      <Pressable onPress={onDismiss} style={s.trash} accessibilityRole="button" accessibilityLabel={shown.items.length > 1 ? 'Look verwijderen' : 'Item verwijderen'}><Ionicons name="trash-outline" size={21} color="#000"/></Pressable>
    </View>
    <Text style={s.buyNote}>Testaankoop: er wordt niets afgerekend.</Text>
  </Animated.View>;
}

/** Shown on "Opslaan" when the outfit still contains paid items that weren't (mock) bought. */
function SaveCheckSheet({ items, bottomInset, onBuyAndSave, onSaveWithout, onCancel }: { items: WardrobeItem[]; bottomInset: number; onBuyAndSave: () => void; onSaveWithout: () => void; onCancel: () => void }) {
  const total = totalCents(items);
  return <View style={StyleSheet.absoluteFill}>
    <Pressable style={s.scrim} onPress={onCancel} accessibilityLabel="Annuleren"/>
    <View style={[s.buySheet, { paddingBottom: bottomInset + 16 }]} accessibilityViewIsModal>
      <View style={s.buyHandle}/>
      <View style={s.checkHead}>
        <Text style={[s.buyTitle, { flex: 1 }]}>Niet-gekochte items</Text>
        <Pressable onPress={onCancel} style={s.checkClose} accessibilityRole="button" accessibilityLabel="Sluiten"><Ionicons name="close" size={20} color="#000"/></Pressable>
      </View>
      <Text style={s.buySub}>Deze items heb je nog niet gekocht. Zonder kopen worden ze niet in je outfit opgeslagen.</Text>
      <View style={s.checkList}>
        {items.map(i => <View key={i.id} style={s.checkItem}>
          <View style={s.checkThumb}><ItemThumb item={i} width={40} height={40}/></View>
          <Text style={s.checkName} numberOfLines={1}>{i.name}</Text>
          <Text style={s.buyPrice}>{priceText(i.priceCents ?? 0)}</Text>
        </View>)}
      </View>
      <Pressable onPress={onBuyAndSave} style={({ pressed }) => [s.checkPrimary, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`Kopen en opslaan voor ${formatPriceCents(total)}`}>
        <Text style={s.buyBtnText}>Kopen en opslaan · {priceText(total)}</Text>
      </Pressable>
      <Pressable onPress={onSaveWithout} style={({ pressed }) => [s.checkSecondary, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={s.checkSecondaryText}>Opslaan zonder deze items</Text>
      </Pressable>
      <Text style={s.buyNote}>Testaankoop: er wordt niets afgerekend.</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  artShadow: { alignSelf: 'center', width: '70%', height: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)', marginTop: -6, zIndex: -1 },
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  avatarWrap: { position: 'absolute' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.78)', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { height: 38, paddingHorizontal: 20, borderRadius: 19, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  saveText: { color: '#000', fontSize: 16, fontWeight: '800' },
  strip: { position: 'absolute', right: 12, width: 40 },
  stripContent: { alignItems: 'center', gap: 8, paddingVertical: 2 },
  swatchRing: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive: { borderColor: '#FFF' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  gear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  slider: { position: 'absolute', left: 16, width: 30, height: 74, borderRadius: 15, backgroundColor: 'rgba(58,58,60,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  sliderKnob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#E5E5EA', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  history: { position: 'absolute', left: 16, flexDirection: 'row', gap: 8 },
  historyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.78)', alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2C2C2E' },
  handle: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: '#48484A', marginTop: 8 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 18, marginTop: 6 },
  tab: { alignItems: 'center', minWidth: 80, paddingTop: 4, gap: 2 },
  tabText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFF', fontWeight: '800' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF', marginTop: 2 },
  catRowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2C2C2E', marginTop: 4 },
  catRow: { paddingHorizontal: 8 },
  cat: { width: 54, height: 46, alignItems: 'center', justifyContent: 'flex-end' },
  catLine: { width: 38, height: 2, borderRadius: 1, backgroundColor: '#FFF', marginTop: 9 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  chip: { flex: 1, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  chipActive: { backgroundColor: '#0E2A16' },
  chipText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  grid: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  cardRing: { borderRadius: 15, borderWidth: 2.5, borderColor: 'transparent', padding: 0.5 },
  card: { flex: 1, borderRadius: 12, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  euro: { position: 'absolute', right: 6, bottom: 4, width: 21, height: 21, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center' },
  euroText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: -1 },
  brand: { color: '#9A9AA0', fontSize: 11.5, textAlign: 'center', height: 28, lineHeight: 26, paddingHorizontal: 4 },
  empty: { color: '#8E8E93', textAlign: 'center', marginTop: 30, fontSize: 14 },
  avatarPanel: { paddingHorizontal: 12, paddingTop: 12 },
  panelTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 6, marginBottom: 8 },
  panelHint: { color: '#8E8E93', fontSize: 12, marginTop: -2, marginBottom: 8 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  bigSwatchRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  bigSwatchRingActive: { borderColor: BLUE },
  bigSwatch: { width: 31, height: 31, borderRadius: 15.5, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  tipsHalf: { position: 'absolute', left: 0, right: 0, top: 0, height: 13, backgroundColor: '#E2BF74' },
  editorLink: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: '#1C1C1E' },
  editorIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A3A3C', alignItems: 'center', justifyContent: 'center' },
  editorTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  editorSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  hairLabel: { color: '#D1D1D6', fontSize: 12, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  modeHeader: { gap: 0, marginBottom: 2 },
  sectionHead: { marginBottom: 8 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  sectionSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  looksScroll: { marginHorizontal: -12, flexGrow: 0 },
  looksRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 6 },
  lookRing: { width: LOOK_W, borderRadius: 15, borderWidth: 2.5, borderColor: 'transparent' },
  lookCard: { borderRadius: 12, backgroundColor: '#1C1C1E', overflow: 'hidden' },
  lookText: { paddingHorizontal: 8, paddingVertical: 7 },
  lookName: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  lookMeta: { color: '#8E8E93', fontSize: 11.5, marginTop: 2 },
  lookPrice: { color: '#FFF', fontWeight: '700' },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segmentBtn: { flex: 1, height: 34, borderRadius: 17, backgroundColor: '#1C1C1E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentBtnActive: { backgroundColor: '#FFF' },
  segmentText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#000' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  checkHead: { flexDirection: 'row', alignItems: 'center' },
  checkClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  checkList: { marginTop: 10, marginBottom: 12, gap: 6 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#2C2C2E', overflow: 'hidden' },
  checkName: { flex: 1, color: '#1C1C1E', fontSize: 14, fontWeight: '600' },
  checkPrimary: { height: 46, borderRadius: 23, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  checkSecondary: { height: 44, borderRadius: 22, backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  checkSecondaryText: { color: '#000', fontSize: 15, fontWeight: '800' },
  buySheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  buyHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6', marginBottom: 12 },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyTitle: { color: '#000', fontSize: 18, fontWeight: '800' },
  buySub: { color: '#3C3C43', fontSize: 14, marginTop: 2, lineHeight: 18 },
  buyPrice: { color: '#000', fontWeight: '700' },
  buyBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  buyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  trash: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  buyNote: { color: '#8E8E93', fontSize: 11, marginTop: 8 },
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#3A3A3C' },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
