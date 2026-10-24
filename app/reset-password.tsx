import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput} from 'react-native';
import {router} from 'expo-router';
import {Button} from '../components/UI';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {C} from '../lib/theme';

import {friendlyError} from '../lib/db-errors';
export default function ResetPassword() {
  const {session, ready} = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (password.length < 8) {setNotice('Gebruik minimaal 8 tekens.'); return;}
    if (password !== confirmation) {setNotice('De wachtwoorden zijn niet gelijk.'); return;}
    setBusy(true);
    setNotice('');
    try {
      const {error} = await supabase.auth.updateUser({password});
      if (error) throw error;
      await supabase.auth.signOut({scope: 'local'});
      router.replace('/(auth)/login');
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.mark}>✦</Text>
      <Text style={s.heading}>Nieuw wachtwoord</Text>
      <Text style={s.description}>Kies een nieuw wachtwoord voor SnapShot X.</Text>
      {ready && !session ? <>
        <Text style={s.notice}>De herstellink is verlopen. Vraag een nieuwe link aan.</Text>
        <Button onPress={() => router.replace('/(auth)/login')}>Naar inloggen</Button>
      </> : <>
        <TextInput style={s.input} value={password} onChangeText={setPassword}
          placeholder="Nieuw wachtwoord (8+ tekens)" placeholderTextColor={C.muted}
          secureTextEntry autoComplete="new-password" accessibilityLabel="Nieuw wachtwoord"/>
        <TextInput style={s.input} value={confirmation} onChangeText={setConfirmation}
          placeholder="Herhaal nieuw wachtwoord" placeholderTextColor={C.muted}
          secureTextEntry autoComplete="new-password" accessibilityLabel="Herhaal nieuw wachtwoord"/>
        {!!notice && <Text style={s.notice}>{notice}</Text>}
        <Button onPress={() => void save()} disabled={!session || busy || !password || !confirmation}>Wachtwoord opslaan</Button>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bg},
  content: {flexGrow: 1, justifyContent: 'center', padding: 28},
  mark: {color: C.yellow, fontSize: 48},
  heading: {color: C.text, fontSize: 27, fontWeight: '800', marginTop: 12},
  description: {color: C.muted, fontSize: 15, marginVertical: 16},
  input: {color: C.text, backgroundColor: C.surface, borderRadius: 18, padding: 16, marginBottom: 12, fontSize: 16},
  notice: {color: C.danger, marginVertical: 10},
});
