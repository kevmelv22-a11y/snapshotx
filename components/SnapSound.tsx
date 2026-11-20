/** Snap sound UI: background music player (bundled loops) and the "Geluiden" sheet in the snap editor. */
import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { C } from '../lib/theme';
import { MUSIC_TRACKS, VOICE_FILTERS, type SnapSound, type TrackId } from '../lib/snap-sound';

const TRACK_ASSETS: Record<TrackId, number> = {
  'zomerzon': require('../assets/sounds/zomerzon.mp3'),
  'chill-avond': require('../assets/sounds/chill-avond.mp3'),
  'straatbeat': require('../assets/sounds/straatbeat.mp3'),
  'droomwolk': require('../assets/sounds/droomwolk.mp3'),
};

type Loopable = { loop: boolean; volume: number; play: () => void; pause: () => void };
/** Outside the component: the player is a native object we configure, not React state. */
function startLoop(p: Loopable, paused: boolean, volume: number) { p.loop = true; p.volume = volume; if (paused) p.pause(); else p.play(); }

/** Voice filter on a video player: rate without pitch correction (1 = normal). */
export function applyVoiceRate(p: { preservesPitch: boolean; playbackRate: number }, rate: number) { p.preservesPitch = rate === 1; p.playbackRate = rate; }

/** Plays a music loop while mounted (snap / story on screen). Renders nothing. */
export function SnapMusic({ track, paused = false, volume = 0.7 }: { track: TrackId; paused?: boolean; volume?: number }) {
  const player = useAudioPlayer(TRACK_ASSETS[track]);
  useEffect(() => { startLoop(player, paused, volume); }, [player, paused, volume]);
  useEffect(() => () => { try { player.pause(); } catch { /* already released */ } }, [player]);
  return null;
}

/** Small "♪ Zomerzon" pill shown on a snap / story that has sound. */
export function SoundPill({ label }: { label: string }) {
  if (!label) return null;
  return <View style={s.pill} testID="snap-sound-pill" accessibilityLabel={`Geluid: ${label}`}><Text style={s.pillText} numberOfLines={1}>{label}</Text></View>;
}

/** Bottom sheet: pick a music loop and (video only) a voice filter. */
export function SoundSheet({ visible, value, video, onChange, onClose }: { visible: boolean; value: SnapSound; video: boolean; onChange: (s: SnapSound) => void; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Sluiten"/>
    <View style={s.sheet} testID="sound-sheet">
      <Text style={s.title}>Geluiden</Text>
      <Text style={s.hint}>Eigen Snapshot X-muziek, vrij te gebruiken. Speelt af terwijl je vriend je snap bekijkt.</Text>
      <ScrollView style={{ maxHeight: 420 }}>
        <Pressable onPress={() => onChange({ ...value, music: null })} style={s.row} testID="sound-none">
          <Ionicons name="volume-mute-outline" size={22} color={C.text}/><Text style={s.rowText}>Geen muziek</Text>
          <Ionicons name={value.music ? 'ellipse-outline' : 'checkmark-circle'} size={24} color={value.music ? '#77727F' : C.blue}/>
        </Pressable>
        {MUSIC_TRACKS.map(t => { const on = value.music === t.id; return <Pressable key={t.id} onPress={() => onChange({ ...value, music: t.id })} style={s.row} testID={`sound-track-${t.id}`} accessibilityLabel={`Muziek ${t.title}`}>
          <Text style={{ fontSize: 22 }}>{t.emoji}</Text><View style={{ flex: 1 }}><Text style={s.rowText}>{t.title}</Text><Text style={s.sub}>{t.mood} · Snapshot X Sounds</Text></View>
          <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.blue : '#77727F'}/>
        </Pressable>; })}
        <Text style={s.section}>Stemfilter</Text>
        {!video && <Text style={s.sub}>Stemfilters werken op video-snaps. Film een video om je stem te veranderen.</Text>}
        <View style={s.chips}>
          <Pressable onPress={() => onChange({ ...value, voice: null })} disabled={!video} style={[s.chip, !value.voice && s.chipOn, !video && s.off]} testID="voice-none"><Text style={[s.chipText, !value.voice && s.chipTextOn]}>🎤 Normaal</Text></Pressable>
          {VOICE_FILTERS.map(f => { const on = value.voice === f.id; return <Pressable key={f.id} onPress={() => onChange({ ...value, voice: f.id })} disabled={!video} style={[s.chip, on && s.chipOn, !video && s.off]} testID={`voice-${f.id}`} accessibilityLabel={`Stemfilter ${f.label}`}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{f.emoji} {f.label}</Text></Pressable>; })}
        </View>
      </ScrollView>
      <Pressable onPress={onClose} style={s.done} testID="sound-done"><Text style={s.doneText}>Klaar</Text></Pressable>
    </View>
    {visible && value.music && <SnapMusic track={value.music}/>}
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  title: { color: C.text, fontSize: 19, fontWeight: '900' },
  hint: { color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowText: { color: C.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  sub: { color: C.muted, fontSize: 12 },
  section: { color: '#B9B3C6', fontSize: 13, fontWeight: '800', marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#FFFFFF14' },
  chipOn: { backgroundColor: C.yellow },
  chipText: { color: C.text, fontWeight: '700' },
  chipTextOn: { color: '#111' },
  off: { opacity: 0.4 },
  done: { marginTop: 14, backgroundColor: C.blue, borderRadius: 22, paddingVertical: 12, alignItems: 'center' },
  doneText: { color: 'white', fontWeight: '900', fontSize: 16 },
  pill: { alignSelf: 'center', backgroundColor: '#000A', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FFFFFF33', maxWidth: 260 },
  pillText: { color: 'white', fontWeight: '800', fontSize: 13 },
});
