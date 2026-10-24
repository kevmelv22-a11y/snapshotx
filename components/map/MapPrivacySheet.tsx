import React from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {AUDIENCE_OPTIONS, GHOST_OPTIONS, disableGhost, enableGhost, ghostStatusText, isGhost, sharingSummary, toggleAllowed, type GhostDuration, type MapPrivacy} from '../../lib/map-privacy';

export type PrivacyFriend = {id: string; name: string};
type Props = {privacy: MapPrivacy; friends: PrivacyFriend[]; now: number; busy?: boolean; onChange: (next: MapPrivacy) => void; onClose: () => void; renderAvatar?: (f: PrivacyFriend) => React.ReactNode};

/** Bottom sheet: spookmodus (3 u / 24 u / tot uit) and who sees your location. Presentational, no Supabase. */
export function MapPrivacySheet({privacy, friends, now, busy, onChange, onClose, renderAvatar}: Props) {
  const ghost = isGhost(privacy, now);
  const [askDuration, setAskDuration] = React.useState(false);
  const pick = (d: GhostDuration) => { setAskDuration(false); onChange(enableGhost(privacy, d, now)); };
  return <View style={s.card}>
    <View style={s.header}><Text style={s.title}>Locatie-instellingen</Text><Pressable onPress={onClose} accessibilityLabel="Sluiten"><Ionicons name="close" size={24} color="#fff"/></Pressable></View>
    <ScrollView contentContainerStyle={{gap: 14, paddingBottom: 24}}>
      <View style={s.box}>
        <View style={s.row}>
          <Ionicons name="eye-off" size={22} color={ghost ? '#FFE436' : '#fff'}/>
          <View style={{flex: 1}}><Text style={s.label}>Spookmodus</Text><Text style={s.sub}>{ghost ? ghostStatusText(privacy, now) : 'Verberg je locatie voor iedereen.'}</Text></View>
          <Switch value={ghost || askDuration} disabled={busy} onValueChange={v => v ? setAskDuration(true) : (setAskDuration(false), onChange(disableGhost(privacy)))} accessibilityLabel="Spookmodus"/>
        </View>
        {askDuration && !ghost && <View style={s.options}>
          <Text style={s.sub}>Hoe lang?</Text>
          {GHOST_OPTIONS.map(o => <Pressable key={o.key} style={s.option} onPress={() => pick(o.key)} accessibilityLabel={`Spookmodus ${o.label}`}><Text style={s.optionText}>{o.label}</Text></Pressable>)}
        </View>}
      </View>
      <Text style={s.section}>Wie ziet mijn locatie</Text>
      <View style={[s.box, ghost && {opacity: 0.5}]}>
        {AUDIENCE_OPTIONS.map(o => <Pressable key={o.key} disabled={busy} style={s.row} onPress={() => onChange({...privacy, audience: o.key})} accessibilityRole="radio" accessibilityState={{checked: privacy.audience === o.key}}>
          <Ionicons name={privacy.audience === o.key ? 'radio-button-on' : 'radio-button-off'} size={22} color={privacy.audience === o.key ? '#FFE436' : '#aaa'}/>
          <View style={{flex: 1}}><Text style={s.label}>{o.label}</Text><Text style={s.sub}>{o.hint}</Text></View>
        </Pressable>)}
      </View>
      {privacy.audience === 'selected' && <View style={s.box}>
        <Text style={s.sub}>{friends.length ? 'Tik om vrienden aan of uit te zetten' : 'Je hebt nog geen vrienden.'}</Text>
        {friends.map(f => { const on = privacy.allowedIds.includes(f.id); return <Pressable key={f.id} disabled={busy} style={s.row} onPress={() => onChange(toggleAllowed(privacy, f.id))} accessibilityRole="checkbox" accessibilityState={{checked: on}}>
          {renderAvatar?.(f)}<Text style={[s.label, {flex: 1}]}>{f.name}</Text>
          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? '#FFE436' : '#aaa'}/>
        </Pressable>; })}
      </View>}
      <Text style={s.summary}>{sharingSummary(privacy, now)}</Text>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  card: {maxHeight: '80%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#191323', padding: 18},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  title: {color: '#fff', fontSize: 21, fontWeight: '800'},
  box: {backgroundColor: '#251D33', borderRadius: 16, padding: 12, gap: 10},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40},
  label: {color: '#fff', fontSize: 15, fontWeight: '700'},
  sub: {color: '#C8BDD1', fontSize: 13},
  section: {color: '#C8BDD1', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginTop: 4},
  options: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center'},
  option: {backgroundColor: '#8541B5', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8},
  optionText: {color: '#fff', fontWeight: '800'},
  summary: {color: '#FFE436', fontWeight: '800', textAlign: 'center'},
});
