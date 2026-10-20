import React, {useCallback, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router, useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {Avatar} from '../components/UI';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {C} from '../lib/theme';
import {useConfirmDialog} from '../components/ConfirmDialog';

import {friendlyError} from '../lib/db-errors';
type BlockedUser = {id: string; display_name: string; username: string | null};

export default function BlockedUsers() {
  const {session} = useSession();
  const uid = session?.user.id;
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const confirm = useConfirmDialog();

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const blocks = await supabase.from('sx_blocks').select('blocked_id').eq('blocker_id', uid);
    if (blocks.error) {
      setError(friendlyError(blocks.error));
      setLoading(false);
      return;
    }
    const ids = (blocks.data || []).map(row => row.blocked_id);
    if (!ids.length) {
      setUsers([]);
      setError('');
      setLoading(false);
      return;
    }
    const profiles = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
    if (profiles.error) {
      setError(friendlyError(profiles.error));
      setLoading(false);
      return;
    }
    const byId = new Map((profiles.data || []).map(profile => [profile.id, profile]));
    setUsers(ids.map(id => byId.get(id) || {id, display_name: 'Geblokkeerde gebruiker', username: null}));
    setError('');
    setLoading(false);
  }, [uid]);

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]));

  function confirmUnblock(user: BlockedUser) {
    confirm.ask({title: 'Gebruiker deblokkeren?', message: `Je kunt ${user.display_name} daarna weer zien en benaderen.`, confirmLabel: 'Deblokkeren'},
      async () => { await unblock(user.id); return null; });
  }

  async function unblock(id: string) {
    if (!uid || busyId) return;
    setBusyId(id);
    const {data, error: deleteError} = await supabase.from('sx_blocks')
      .delete().eq('blocker_id', uid).eq('blocked_id', id).select('blocked_id');
    if (deleteError) setError(friendlyError(deleteError));
    else if (!data?.length) setError('Deblokkeren is niet gelukt. Probeer het opnieuw.');
    else await load();
    setBusyId(null);
  }

  return <GalaxyScreen>
    <View style={[s.header, {paddingTop: Math.max(insets.top, 14)}]}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Terug" hitSlop={12}>
        <Ionicons name="chevron-back" color="white" size={28}/>
      </Pressable>
      <Text style={s.title}>Geblokkeerde gebruikers</Text>
    </View>
    <Text style={s.explanation}>Geblokkeerde accounts kunnen je geen nieuw bericht of vriendschapsverzoek sturen.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}
    <FlatList data={users} keyExtractor={item => item.id} refreshing={loading} onRefresh={() => void load()}
      contentContainerStyle={s.list}
      ListEmptyComponent={!loading ? <Text style={s.empty}>Je hebt niemand geblokkeerd.</Text> : null}
      renderItem={({item}) => <View style={s.row}>
        <Avatar name={item.display_name} size={48}/>
        <View style={s.identity}>
          <Text style={s.name} numberOfLines={1}>{item.display_name}</Text>
          {!!item.username && <Text style={s.username}>@{item.username}</Text>}
        </View>
        <Pressable style={[s.action, busyId === item.id && s.disabled]} disabled={!!busyId}
          onPress={() => confirmUnblock(item)} accessibilityLabel={`${item.display_name} deblokkeren`}>
          <Text style={s.actionText}>Deblokkeren</Text>
        </Pressable>
      </View>}/>
    {confirm.dialog}
  </GalaxyScreen>;
}

const s = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12},
  title: {color: C.text, fontSize: 21, fontWeight: '800', flex: 1},
  explanation: {color: C.muted, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 12},
  error: {color: C.danger, marginHorizontal: 20, marginBottom: 8},
  list: {paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1},
  empty: {color: C.muted, textAlign: 'center', marginTop: 32, fontSize: 16},
  row: {backgroundColor: C.cardBgTranslucent, padding: 12, borderRadius: 18, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 12},
  identity: {flex: 1, minWidth: 0},
  name: {color: C.text, fontSize: 16, fontWeight: '700'},
  username: {color: C.muted, fontSize: 13, marginTop: 3},
  action: {backgroundColor: C.purple, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10},
  actionText: {color: C.text, fontWeight: '700', fontSize: 13},
  disabled: {opacity: .5},
});
