/**
 * Avatar editor ("SnapShot X"): same ChatGPT-style art and tiles as the Avatar-kast (OutfitArt / ArtTile).
 * Mode = curated looks, Kast = saved outfit / start look, Avatar = character (Man / Vrouw) + skin tone, hair colour
 * and hairstyle (AppearancePicker: recoloured band overlays of the same art, lib/avatar/tones).
 * Everything is saved into the per-account wardrobe (stores/wardrobe); paid looks go to the Kast to be (mock) bought.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtTile, KastStage } from '../components/avatar/ArtTile';
import { AppearancePicker } from '../components/avatar/AppearancePicker';
import { withAppearance } from '../lib/avatar/tones';
import { OutfitArt, outfitArtId } from '../components/avatar/OutfitArt';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { useSession } from '../hooks/useSession';
import { useOwnOutfit, useWardrobeSync } from '../hooks/useWardrobeSync';
import { CHARACTER_LABEL, saveCharacter } from '../lib/avatar/character';
import { CATEGORIES, applyLook, defaultOutfitFor, isOwned, unownedItems, type Gender, type Outfit } from '../lib/avatar/outfit';
import { CURATED_LOOKS, ITEMS_BY_ID, WARDROBE_ITEMS, type CuratedLook } from '../lib/avatar/wardrobeItems';
import { friendlyError } from '../lib/db-errors';
import { useWardrobe } from '../stores/wardrobe';

type Tab = 'mode' | 'kast' | 'avatar';
type Draft = { outfit: Outfit; label: string };
const GENDERS: Gender[] = ['male', 'female'];
const genderOf = (o: Outfit): Gender => (o.gender === 'female' ? 'female' : 'male');
const sameOutfit = (a: Outfit, b: Outfit) => genderOf(a) === genderOf(b) && CATEGORIES.every(c => (a[c] ?? null) === (b[c] ?? null)) && (a.worn ?? null) === (b.worn ?? null)
  && (a.colors.skin ?? null) === (b.colors.skin ?? null) && (a.colors.hair ?? null) === (b.colors.hair ?? null);
const lookOutfit = (look: CuratedLook, gender: Gender, from: Outfit): Outfit => withAppearance({ ...applyLook(defaultOutfitFor(gender), look.items), gender }, from);
const lookItems = (look: CuratedLook) => Object.values(look.items).map(id => ITEMS_BY_ID.get(id!)!).filter(Boolean);

export default function AvatarEditor() {
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  useWardrobeSync(uid);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const confirm = useConfirmDialog();
  const saved = useOwnOutfit(uid); // per-account saved kast outfit (null = none yet)
  const gender = useWardrobe(st => st.gender);
  const unlocked = useWardrobe(st => st.unlocked);
  const start = useMemo<Outfit>(() => saved ?? defaultOutfitFor(gender), [saved, gender]);

  const [tab, setTab] = useState<Tab>('mode');
  const [draft, setDraft] = useState<Draft>(() => ({ outfit: start, label: saved ? 'outfit uit je Avatar-kast' : 'startlook' }));
  const [past, setPast] = useState<Draft[]>([]);
  const [future, setFuture] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const g = genderOf(draft.outfit);
  // The saved outfit arrives after the wardrobe hydrates / syncs: follow it until the user edits something
  // (state adjusted during render, React's pattern for props-derived state).
  const startId = JSON.stringify(start);
  const [seenStart, setSeenStart] = useState(startId);
  if (seenStart !== startId) {
    setSeenStart(startId);
    if (!past.length && !future.length) setDraft({ outfit: start, label: saved ? 'outfit uit je Avatar-kast' : 'startlook' });
  }
  const changed = !sameOutfit(draft.outfit, start);

  function change(next: Draft) {
    if (sameOutfit(next.outfit, draft.outfit)) return;
    setPast(p => [...p.slice(-19), draft]); setFuture([]); setDraft(next);
  }
  const undo = () => { if (!past.length) return; setFuture(f => [...f, draft]); setDraft(past[past.length - 1]); setPast(past.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast(p => [...p, draft]); setDraft(future[future.length - 1]); setFuture(future.slice(0, -1)); };
  /** Same outfit on the other character set; without any saved outfit / picked look that is that set's start look. */
  const asCharacter = (next: Gender): Outfit => withAppearance(sameOutfit(draft.outfit, defaultOutfitFor(g)) ? defaultOutfitFor(next) : { ...draft.outfit, gender: next }, draft.outfit);

  async function save() {
    if (!uid || busy) return;
    if (!changed) { router.back(); return; }
    setBusy(true);
    const error = g !== gender ? await saveCharacter(g) : null;
    setBusy(false);
    if (error) { setNotice(friendlyError(error, 'Opslaan')); return; }
    const st = useWardrobe.getState();
    if (sameOutfit(draft.outfit, st.saved)) { router.back(); return; } // only the character changed (setGender already updated the saved outfit)
    st.apply(draft.outfit);
    if (unownedItems(draft.outfit, WARDROBE_ITEMS, st.unlocked).length) { router.replace({ pathname: '/avatar/kast', params: { keep: '1' } }); return; } // buy (mock) + save there
    st.save(uid);
    router.back();
  }
  function discard() {
    if (!changed) { router.back(); return; }
    confirm.ask({ title: 'Wijzigingen weggooien?', message: 'Je avatar is nog niet opgeslagen.', cancelLabel: 'Verder bewerken', confirmLabel: 'Weggooien', destructive: true }, () => { router.back(); return null; });
  }

  const W = Math.min(winW, 520);
  const stageH = Math.round(winH * 0.46);
  const artW = Math.min(170, Math.max(110, (stageH - insets.top - 118) / 1.77));
  const tileW = Math.floor((W - 24 - 16) / 3);
  const tileImg = Math.round(tileW * 1.19);
  const tile = (key: string, outfit: Outfit, label: string, meta: string | undefined, onPress: () => void, badge?: string) =>
    <ArtTile key={key} outfit={outfit} width={tileW} imageHeight={tileImg} label={label} meta={meta} badge={badge}
      selected={sameOutfit(outfit, draft.outfit)} onPress={onPress} testID={`editor-tile:${key}`}/>;

  return <View style={s.root}>
    <StatusBar style="light"/>
    <View style={{ height: stageH }}>
      <KastStage width={winW} height={stageH}/>
      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={discard} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Editor sluiten" hitSlop={8}><Ionicons name="close" size={26} color="#FFF"/></Pressable>
        <Text style={s.brand}>SnapShot X</Text>
        <Pressable onPress={() => void save()} disabled={busy} style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Avatar opslaan"><Text style={s.saveText}>{busy ? 'Opslaan…' : 'Opslaan'}</Text></Pressable>
      </View>
      <View style={[s.hero, { top: insets.top + 58 }]} pointerEvents="none" testID={`editor-hero-art:${outfitArtId(draft.outfit)}`}>
        <OutfitArt outfit={draft.outfit} width={artW} height={artW * 1.77}/>
        <View style={s.artShadow}/>
        <Text style={s.caption} numberOfLines={1}>Jouw avatar · {draft.label}</Text>
      </View>
      <View style={[s.history, { top: stageH - 54 }]}>
        <Pressable onPress={undo} disabled={!past.length} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Ongedaan maken"><MaterialCommunityIcons name="undo-variant" size={23} color={past.length ? '#FFF' : '#6C6C70'}/></Pressable>
        <Pressable onPress={redo} disabled={!future.length} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Opnieuw uitvoeren"><MaterialCommunityIcons name="redo-variant" size={23} color={future.length ? '#FFF' : '#6C6C70'}/></Pressable>
      </View>
    </View>

    <View style={s.sheet}>
      <View style={s.handle}/>
      <View style={s.tabs}>
        {([['mode', 'Mode'], ['kast', 'Kast'], ['avatar', 'Avatar']] as const).map(([id, label]) => {
          const active = tab === id;
          const color = active ? '#FFF' : '#8E8E93';
          return <Pressable key={id} onPress={() => setTab(id)} style={s.tab} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}>
            {id === 'mode' ? <MaterialCommunityIcons name="hanger" size={26} color={color}/> : id === 'kast' ? <Ionicons name={active ? 'heart' : 'heart-outline'} size={24} color={color}/> : <Ionicons name="person-circle-outline" size={25} color={color}/>}
            <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
            <View style={[s.tabDot, !active && { opacity: 0 }]}/>
          </Pressable>;
        })}
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        {tab === 'mode' && <>
          <Text style={s.title}>Probeer een look</Text>
          <Text style={s.hint}>Tik op een look om hem op je avatar te zien. Betaalde items (€) koop je daarna in de Kast.</Text>
          <View style={s.grid}>{CURATED_LOOKS.map(look => {
            const items = lookItems(look);
            const toBuy = items.filter(i => !isOwned(i, unlocked));
            const o = lookOutfit(look, g, draft.outfit);
            return tile(look.id, o, look.name, `${items.length} items`, () => change({ outfit: o, label: look.name }), toBuy.length ? '€' : undefined);
          })}</View>
        </>}
        {tab === 'kast' && <>
          <Text style={s.title}>Mijn kast</Text>
          <View style={s.grid}>
            {saved && tile('saved', { ...saved, gender: g }, 'Opgeslagen', 'outfit uit je kast', () => change({ outfit: { ...saved, gender: g }, label: 'outfit uit je Avatar-kast' }))}
            {tile('start', withAppearance(defaultOutfitFor(g), draft.outfit), 'Startlook', CHARACTER_LABEL[g], () => change({ outfit: withAppearance(defaultOutfitFor(g), draft.outfit), label: 'startlook' }))}
          </View>
          <Pressable onPress={() => router.push('/avatar/kast')} style={({ pressed }) => [s.link, pressed && { opacity: 0.8 }]} accessibilityRole="link" accessibilityLabel="Open de Avatar-kast">
            <View style={s.linkIcon}><MaterialCommunityIcons name="hanger" size={20} color="#FFF"/></View>
            <View style={{ flex: 1 }}><Text style={s.linkTitle}>Open de Avatar-kast</Text><Text style={s.linkSub}>Alle kleding, losse items en kopen</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93"/>
          </Pressable>
        </>}
        {tab === 'avatar' && <>
          <Text style={s.title}>Karakter</Text>
          <View style={s.grid}>{GENDERS.map(id => tile(`character-${id}`, g === id ? draft.outfit : asCharacter(id), CHARACTER_LABEL[id], g === id ? 'Gekozen' : undefined,
            () => change({ outfit: asCharacter(id), label: draft.label })))}</View>
          <AppearancePicker outfit={draft.outfit} tileSize={Math.min(104, tileW)} onChange={(outfit, label) => change({ outfit, label })}/>
        </>}
      </ScrollView>
      {!!notice && <Pressable onPress={() => setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice} ×</Text></Pressable>}
    </View>
    {confirm.dialog}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.78)', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  saveBtn: { height: 38, paddingHorizontal: 20, borderRadius: 19, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#000', fontSize: 16, fontWeight: '800' },
  hero: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  artShadow: { width: 110, height: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)', marginTop: -6, zIndex: -1 },
  caption: { color: '#AEAEB2', fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  history: { position: 'absolute', left: 16, flexDirection: 'row', gap: 8 },
  sheet: { flex: 1, marginTop: -20, backgroundColor: '#000', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2C2C2E' },
  handle: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: '#48484A', marginTop: 8 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 18, marginTop: 6 },
  tab: { alignItems: 'center', minWidth: 80, paddingTop: 4, gap: 2 },
  tabText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFF', fontWeight: '800' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF', marginTop: 2 },
  body: { paddingHorizontal: 12, paddingTop: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  hint: { color: '#8E8E93', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, padding: 14, borderRadius: 14, backgroundColor: '#1C1C1E' },
  linkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A3A3C', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  linkSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 24, padding: 12, borderRadius: 12, backgroundColor: '#3A3A3C' },
  noticeText: { color: '#FFF', textAlign: 'center', fontWeight: '700' },
});
