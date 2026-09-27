import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import * as Linking from 'expo-linking';
import {Link, router} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';

export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const handled = useRef<string | null>(null);
  const [message, setMessage] = useState('Je e-mailadres wordt bevestigd…');

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    let active = true;

    async function finish() {
      try {
        const parsed = new URL(url!);
        const query = new URLSearchParams(parsed.search);
        const fragment = new URLSearchParams(parsed.hash.slice(1));
        if (query.has('error') || fragment.has('error')) throw new Error('Authentication failed');

        const access_token = fragment.get('access_token') ?? query.get('access_token');
        const refresh_token = fragment.get('refresh_token') ?? query.get('refresh_token');
        const code = query.get('code');
        const isRecovery = (fragment.get('type') ?? query.get('type')) === 'recovery';
        if (access_token && refresh_token) {
          const {error} = await supabase.auth.setSession({access_token, refresh_token});
          if (error) throw error;
        } else if (code) {
          const {error} = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          if (active) setMessage('De link heeft de app geopend. Probeer nu in te loggen met je wachtwoord.');
          return;
        }

        if (active) router.replace(isRecovery ? '/reset-password' : '/(tabs)');
      } catch {
        if (active) setMessage('De bevestigingslink kon niet worden afgerond. Probeer in te loggen of vraag een nieuwe link aan.');
      }
    }

    void finish();
    return () => { active = false; };
  }, [url]);

  return <View style={styles.container}>
    <Text style={styles.mark}>✦</Text>
    <Text style={styles.title}>SnapShot X</Text>
    <Text style={styles.message}>{message}</Text>
    <Link href="/(auth)/login" style={styles.link}>Naar inloggen</Link>
  </View>;
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: C.bg},
  mark: {fontSize: 48, color: C.yellow},
  title: {fontSize: 28, fontWeight: '900', color: C.text, marginTop: 12},
  message: {color: C.text, textAlign: 'center', marginTop: 20},
  link: {color: C.yellow, fontWeight: '700', marginTop: 24},
});
