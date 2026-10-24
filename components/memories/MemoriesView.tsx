import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {PIN_LENGTH, flashbackTitle, groupByDate, isLocked, lockText, onThisDay, type Memory, type PinLock} from '../../lib/memories';

type Thumb = (m: Memory, style: any) => React.ReactNode;
type Props = {
  memories: Memory[]; now: number; tzOffsetMin: number; renderThumb: Thumb;
  tab: 'all' | 'private'; onTab: (t: 'all' | 'private') => void;
  vaultUnlocked: boolean; hasPin: boolean; lock: PinLock; pinError?: string;
  onSubmitPin: (pin: string) => void; onOpen: (m: Memory) => void; notice?: string;
};

/** Grid by date + 'Op deze dag' + 'Alleen voor mij' tab with pin pad. Presentational. */
export function MemoriesView(p: Props) {
  const flash = onThisDay(p.memories, p.now, p.tzOffsetMin);
  const sections = p.tab === 'all' ? groupByDate(p.memories, p.now, {tzOffsetMin: p.tzOffsetMin}) : groupByDate(p.memories.filter(m => m.private), p.now, {tzOffsetMin: p.tzOffsetMin, includePrivate: true});
  return <View style={s.root}>
    <View style={s.tabs}>
      {(['all', 'private'] as const).map(t => <Pressable key={t} onPress={() => p.onTab(t)} style={[s.tab, p.tab === t && s.tabOn]} accessibilityRole="tab" accessibilityState={{selected: p.tab === t}}>
        {t === 'private' && <Ionicons name="lock-closed" size={13} color={p.tab === t ? '#1A1425' : '#fff'}/>}
        <Text style={[s.tabText, p.tab === t && {color: '#1A1425'}]}>{t === 'all' ? 'Alles' : 'Alleen voor mij'}</Text>
      </Pressable>)}
    </View>
    {!!p.notice && <Text style={s.notice}>{p.notice}</Text>}
    {p.tab === 'private' && !p.vaultUnlocked ? <PinPad title={p.hasPin ? 'Voer je pincode in' : 'Kies een pincode van 4 cijfers'} error={p.pinError || lockText(p.lock, p.now)} locked={isLocked(p.lock, p.now)} onSubmit={p.onSubmitPin}/> :
    <ScrollView contentContainerStyle={{paddingBottom: 40}}>
      {p.tab === 'all' && flash.map(f => <View key={f.yearsAgo} style={s.flash}>
        <View style={s.flashHead}><Ionicons name="time" size={18} color="#1A1425"/><Text style={s.flashTitle}>{flashbackTitle(f.yearsAgo)}</Text></View>
        <ScrollView horizontal contentContainerStyle={{gap: 8}}>{f.items.map(m => <Pressable key={m.id} onPress={() => p.onOpen(m)} accessibilityLabel={flashbackTitle(f.yearsAgo)}>{p.renderThumb(m, s.flashThumb)}</Pressable>)}</ScrollView>
      </View>)}
      {!sections.length && <Text style={s.empty}>{p.tab === 'all' ? 'Nog geen herinneringen. Bewaar een snap met de knop "Bewaren".' : 'Nog niets in Alleen voor mij.'}</Text>}
      {sections.map(sec => <View key={sec.key}>
        <Text style={s.section}>{sec.title}</Text>
        <View style={s.grid}>{sec.items.map(m => <Pressable key={m.id} style={s.cell} onPress={() => p.onOpen(m)} accessibilityLabel={`Herinnering ${sec.title}`}>
          {p.renderThumb(m, s.thumb)}
          {m.media_type === 'video' && <Ionicons name="play" size={16} color="#fff" style={s.badge}/>}
          {m.private && <Ionicons name="lock-closed" size={14} color="#fff" style={s.badge}/>}
        </Pressable>)}</View>
      </View>)}
    </ScrollView>}
  </View>;
}

export function PinPad({title, error, locked, onSubmit}: {title: string; error?: string; locked?: boolean; onSubmit: (pin: string) => void}) {
  const [pin, setPin] = useState('');
  const press = (d: string) => { if (locked) return; const next = (pin + d).slice(0, PIN_LENGTH); setPin(next); if (next.length === PIN_LENGTH) { onSubmit(next); setPin(''); } };
  return <View style={s.pin}>
    <Ionicons name="lock-closed" size={36} color="#FFE436"/>
    <Text style={s.pinTitle}>{title}</Text>
    <View style={s.dots}>{Array.from({length: PIN_LENGTH}, (_, i) => <View key={i} style={[s.dot, i < pin.length && s.dotOn]}/>)}</View>
    {!!error && <Text style={s.pinError}>{error}</Text>}
    <View style={s.keys}>{['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => k === '' ? <View key={i} style={s.key}/> :
      <Pressable key={i} style={[s.key, s.keyOn, locked && {opacity: 0.4}]} onPress={() => k === '⌫' ? setPin(pin.slice(0, -1)) : press(k)} accessibilityLabel={k === '⌫' ? 'Wissen' : k}><Text style={s.keyText}>{k}</Text></Pressable>)}</View>
  </View>;
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0D0618'},
  tabs: {flexDirection: 'row', gap: 8, padding: 12},
  tab: {flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#251D33'},
  tabOn: {backgroundColor: '#FFE436'},
  tabText: {color: '#fff', fontWeight: '800'},
  notice: {color: '#fff', backgroundColor: '#3A2A55', marginHorizontal: 12, padding: 10, borderRadius: 12},
  flash: {margin: 12, padding: 12, borderRadius: 18, backgroundColor: '#FFE436', gap: 10},
  flashHead: {flexDirection: 'row', gap: 6, alignItems: 'center'},
  flashTitle: {color: '#1A1425', fontWeight: '900', fontSize: 16},
  flashThumb: {width: 110, height: 150, borderRadius: 12, overflow: 'hidden'},
  section: {color: '#fff', fontWeight: '800', fontSize: 16, marginHorizontal: 12, marginTop: 16, marginBottom: 8},
  grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 3, paddingHorizontal: 2},
  cell: {width: '32.8%', height: 170},
  thumb: {width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden'},
  badge: {position: 'absolute', top: 6, right: 6},
  empty: {color: '#C8BDD1', textAlign: 'center', marginTop: 40, paddingHorizontal: 30},
  pin: {alignItems: 'center', paddingTop: 40, gap: 14},
  pinTitle: {color: '#fff', fontSize: 18, fontWeight: '800'},
  dots: {flexDirection: 'row', gap: 14},
  dot: {width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff'},
  dotOn: {backgroundColor: '#FFE436', borderColor: '#FFE436'},
  pinError: {color: '#FF6B6B', fontWeight: '700', textAlign: 'center', paddingHorizontal: 20},
  keys: {flexDirection: 'row', flexWrap: 'wrap', width: 260, gap: 12, justifyContent: 'center'},
  key: {width: 72, height: 60, alignItems: 'center', justifyContent: 'center'},
  keyOn: {borderRadius: 30, backgroundColor: '#251D33'},
  keyText: {color: '#fff', fontSize: 24, fontWeight: '700'},
});

export type ResendTarget = {id: string; name: string};
/** Full-screen memory with actions; `picking` shows the re-send recipient list. */
export function MemoryDetail({memory, title, renderThumb, targets, busy, onResend, onTogglePrivate, onClose, initialPicking = false}: {initialPicking?: boolean; memory: Memory; title: string; renderThumb: Thumb; targets: ResendTarget[]; busy?: boolean; onResend: (ids: string[]) => void; onTogglePrivate: () => void; onClose: () => void}) {
  const [picking, setPicking] = useState(initialPicking);
  const [sel, setSel] = useState<string[]>([]);
  return <View style={d.root}>
    {renderThumb(memory, d.media)}
    <View style={d.top}><Pressable onPress={onClose} accessibilityLabel="Sluiten"><Ionicons name="close" size={28} color="#fff"/></Pressable><Text style={d.title}>{title}</Text><View style={{width: 28}}/></View>
    {picking ? <View style={d.sheet}>
      <Text style={d.sheetTitle}>Opnieuw versturen naar</Text>
      {targets.map(t => { const on = sel.includes(t.id); return <Pressable key={t.id} style={d.row} onPress={() => setSel(on ? sel.filter(x => x !== t.id) : [...sel, t.id])} accessibilityRole="checkbox" accessibilityState={{checked: on}}>
        <Text style={d.rowText}>{t.name}</Text><Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? '#4298FF' : '#aaa'}/></Pressable>; })}
      <View style={{flexDirection: 'row', gap: 8}}>
        <Pressable style={[d.btn, {backgroundColor: '#333'}]} onPress={() => setPicking(false)}><Text style={d.btnText}>Annuleren</Text></Pressable>
        <Pressable style={[d.btn, !sel.length && {opacity: 0.5}]} disabled={!sel.length || busy} onPress={() => onResend(sel)}><Ionicons name="send" size={16} color="#fff"/><Text style={d.btnText}>Versturen{sel.length ? ` (${sel.length})` : ''}</Text></Pressable>
      </View>
    </View> : <View style={d.actions}>
      <Pressable style={d.btn} onPress={() => setPicking(true)} accessibilityLabel="Opnieuw versturen"><Ionicons name="send" size={16} color="#fff"/><Text style={d.btnText}>Opnieuw versturen</Text></Pressable>
      <Pressable style={[d.btn, {backgroundColor: '#3A2A55'}]} disabled={busy} onPress={onTogglePrivate}><Ionicons name={memory.private ? 'lock-open' : 'lock-closed'} size={16} color="#fff"/><Text style={d.btnText}>{memory.private ? 'Uit Alleen voor mij' : 'Naar Alleen voor mij'}</Text></Pressable>
    </View>}
  </View>;
}
const d = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  media: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  top: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50},
  title: {color: '#fff', fontWeight: '800', fontSize: 16, textShadowColor: '#000', textShadowRadius: 4},
  actions: {position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap'},
  btn: {flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#4298FF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24},
  btnText: {color: '#fff', fontWeight: '800'},
  sheet: {position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#191323', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 8},
  sheetTitle: {color: '#fff', fontWeight: '800', fontSize: 18},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8},
  rowText: {color: '#fff', fontSize: 15, fontWeight: '600'},
});
