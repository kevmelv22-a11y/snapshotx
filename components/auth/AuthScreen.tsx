import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { supabase, DEMO_MODE } from '../../lib/supabase';
import { WEB_FOOTER } from '../../lib/web-layout';
import { DEMO_EMAIL } from '../../lib/demo-client';
import { friendlyError } from '../../lib/db-errors';
import { classifyIdentifier, validateRegister } from '../../lib/auth-form';
import { LEGAL_CONSENT, LEGAL_LINKS } from '../../lib/legal';

export type AuthMode = 'login' | 'register';
const CYAN = '#2EE6FF';
const LOGO = require('../../assets/auth-ghost-logo.png');

/** Full-screen gradient: deep red-brown (top-left) → near-black → teal (bottom-right). */
function Backdrop() {
  return <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
    <Defs><LinearGradient id="sxAuthBg" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#3A140E"/><Stop offset="0.45" stopColor="#1A1012"/><Stop offset="0.75" stopColor="#0E1A1E"/><Stop offset="1" stopColor="#06363C"/>
    </LinearGradient></Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#sxAuthBg)"/>
  </Svg>;
}

/** Neon ghost (existing app-icon art) with a cyan lightning bolt top-right, as in the prototype. */
function Logo() {
  return <View style={s.logoWrap} accessibilityRole="image" accessibilityLabel="Snapshot X-logo">
    <Image source={LOGO} style={s.logo} resizeMode="contain"/>
    <Svg width={46} height={46} viewBox="0 0 24 24" style={s.bolt}>
      <Path d="M14 2 L5 13.5 H11 L9.5 22 L19 9.5 H13 Z" fill="none" stroke={CYAN} strokeWidth={1.6} strokeLinejoin="round"/>
    </Svg>
  </View>;
}

function Wordmark() {
  return <Svg width={290} height={44} viewBox="0 0 290 44" style={{ alignSelf: 'center' }} accessibilityLabel="Snapshot X">
    <Defs><LinearGradient id="sxWord" x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#FF4A2B"/><Stop offset="0.35" stopColor="#E0583A"/><Stop offset="0.55" stopColor="#6A5450"/><Stop offset="0.8" stopColor="#2EC9D6"/><Stop offset="1" stopColor={CYAN}/>
    </LinearGradient></Defs>
    <SvgText x="145" y="34" textAnchor="middle" fontSize="34" fontWeight="500" letterSpacing="5" fontFamily="Montserrat, Avenir Next, Helvetica Neue, Arial, sans-serif" fill="url(#sxWord)">SNAPSHOT X</SvgText>
  </Svg>;
}

function Field({ label, ...p }: TextInputProps & { label: string }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <TextInput placeholderTextColor="rgba(255,255,255,0.55)" autoCapitalize="none" autoCorrect={false} {...p} style={s.input} accessibilityLabel={label}/>
  </View>;
}

export function AuthScreen({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [identifier, setIdentifier] = useState(''), [password, setPassword] = useState('');
  const [username, setUsername] = useState(''), [email, setEmail] = useState(''), [birthdate, setBirthdate] = useState(''), [phone, setPhone] = useState('');
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const contentW = Math.min(width, 480);

  function switchMode(m: AuthMode) { setMode(m); setNotice(''); }

  async function login() {
    const id = classifyIdentifier(identifier);
    if (!id) { setNotice('Vul je gebruikersnaam, e-mail of telefoonnummer in.'); return; }
    setBusy(true); setNotice('');
    try {
      let creds: { email: string; password: string } | { phone: string; password: string };
      if (id.kind === 'email') creds = { email: id.email, password };
      else if (id.kind === 'phone') creds = { phone: id.phone, password };
      else if (DEMO_MODE) creds = { email: DEMO_EMAIL, password };
      else {
        // Username → e-mail via a server-side lookup (optional RPC; returns null for unknown names).
        const { data, error } = await supabase.rpc('sx_login_email_for_username', { p_username: id.username });
        if (error || typeof data !== 'string' || !data) throw new Error(error?.code === 'PGRST202' ? 'Inloggen met gebruikersnaam is nog niet beschikbaar. Gebruik je e-mail of telefoonnummer.' : 'Onjuiste inloggegevens.');
        creds = { email: data, password };
      }
      const { error } = await supabase.auth.signInWithPassword(creds as { email: string; password: string });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch (e) { setNotice(friendlyError(e)); } finally { setBusy(false); }
  }

  async function recover() {
    const id = classifyIdentifier(identifier);
    if (id?.kind !== 'email') { setNotice('Vul eerst je e-mailadres in.'); return; }
    setBusy(true);
    try { const { error } = await supabase.auth.resetPasswordForEmail(id.email, { redirectTo: 'snapshotx://auth/callback' }); if (error) throw error; setNotice('Als dit adres bestaat, ontvang je een herstelmail.'); }
    catch (e) { setNotice(friendlyError(e)); } finally { setBusy(false); }
  }

  async function register() {
    const v = validateRegister({ username, email, password, birthdate, phone });
    if (!v.ok) { setNotice(v.error); return; }
    setBusy(true); setNotice('');
    try {
      const { data, error } = await supabase.auth.signUp({ email: v.email, password, options: { emailRedirectTo: 'snapshotx://auth/callback', data: { username: v.username, display_name: v.username, birthdate: v.birthdate, is_teen: v.teen, ...(v.phone ? { phone: v.phone } : {}) } } });
      if (error) throw error;
      if (data.session) { router.replace('/(tabs)/profile'); return; }
      setNotice('Controleer je e-mail om je account te bevestigen.');
    } catch (e) { setNotice(friendlyError(e)); } finally { setBusy(false); }
  }

  const isLogin = mode === 'login';
  const canSubmit = !busy && (isLogin ? !!identifier && !!password : !!username && !!email && !!password && !!birthdate);
  return <View style={s.root}>
    <Backdrop/>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={[s.body, { width: contentW }]}>
          <Logo/>
          <Wordmark/>
          <Text style={s.subtitle}>Snaps, stories en chat met je vrienden.</Text>
          <View style={s.toggle} accessibilityRole="tablist">
            {(['login', 'register'] as const).map(m => <Pressable key={m} onPress={() => switchMode(m)} style={[s.seg, mode === m && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} testID={`auth-tab-${m}`}>
              <Text style={[s.segText, mode === m && s.segTextOn]}>{m === 'login' ? 'Inloggen' : 'Registreren'}</Text>
            </Pressable>)}
          </View>
          {isLogin ? <>
            <Field label="Gebruikersnaam, e-mail of telefoon" value={identifier} onChangeText={setIdentifier} autoComplete="username" textContentType="username"/>
            <Field label="Wachtwoord" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={() => canSubmit && void login()}/>
          </> : <>
            <Field label="Gebruikersnaam" placeholder="bijv. kevin.dev" value={username} onChangeText={setUsername} autoComplete="username-new"/>
            <Field label="E-mail" placeholder="jij@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"/>
            <Field label="Wachtwoord" placeholder="Minimaal 8 tekens" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" textContentType="newPassword"/>
            <Field label="Geboortedatum" placeholder="DD-MM-JJJJ" value={birthdate} onChangeText={setBirthdate} keyboardType="numbers-and-punctuation" maxLength={10} autoComplete="birthdate-full"/>
            <Field label="Mobiel nummer (optioneel)" placeholder="+31612345678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"/>
            <Text style={s.hint}>Minimaal 13 jaar. Voor 13–17 jaar gelden automatisch strengere privacy-instellingen.</Text>
            <Text style={s.hint} testID="auth-legal">{LEGAL_CONSENT.before}<Text style={s.legalLink} accessibilityRole="link" onPress={() => router.push(LEGAL_LINKS.terms.route)}>{LEGAL_CONSENT.terms}</Text>{LEGAL_CONSENT.middle}<Text style={s.legalLink} accessibilityRole="link" onPress={() => router.push(LEGAL_LINKS.privacy.route)}>{LEGAL_CONSENT.privacy}</Text>{LEGAL_CONSENT.after}</Text>
          </>}
          {!!notice && <Text style={s.notice}>{notice}</Text>}
          <Pressable onPress={() => void (isLogin ? login() : register())} disabled={!canSubmit} style={({ pressed }) => [s.cta, (!canSubmit || pressed) && { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]} accessibilityRole="button" testID="auth-submit">
            <Text style={s.ctaText}>{isLogin ? 'Inloggen' : 'Account aanmaken'}</Text>
          </Pressable>
          {isLogin && <Pressable onPress={() => void recover()} disabled={busy} style={s.linkBtn}><Text style={s.link}>Wachtwoord vergeten?</Text></Pressable>}
          {isLogin && <Text style={[s.legalSmall, s.linkBtn]} testID="auth-privacy"><Text accessibilityRole="link" onPress={() => router.push(LEGAL_LINKS.privacy.route)}>{LEGAL_LINKS.privacy.label}</Text>{'  ·  '}<Text accessibilityRole="link" onPress={() => router.push(LEGAL_LINKS.terms.route)}>{LEGAL_LINKS.terms.label}</Text></Text>}
          {DEMO_MODE && isLogin && <Pressable onPress={() => { void supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: 'demo' }).then(() => router.replace('/(tabs)')); }} style={s.linkBtn} testID="auth-demo"><Text style={s.link}>Start demo als Kevin</Text></Pressable>}
        </View>
        {Platform.OS === 'web' && <Text style={s.webFooter} testID="web-footer">{WEB_FOOTER}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const s = StyleSheet.create({ webFooter: { color: '#9C93A6', fontSize: 12, textAlign: 'center', marginTop: 28, marginBottom: 12 }, 
  root: { flex: 1, backgroundColor: '#140E10', overflow: 'hidden' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  body: { paddingHorizontal: 24, alignItems: 'stretch' },
  logoWrap: { alignSelf: 'center', width: 170, height: 170 },
  logo: { width: 170, height: 170},
  bolt: { position: 'absolute', right: 22, top: 8 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 16, textAlign: 'center', marginTop: 14, marginBottom: 28 },
  toggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999, padding: 5, marginBottom: 22 },
  seg: { flex: 1, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#F4F2F2' },
  segText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '600' },
  segTextOn: { color: '#0B0B0B', fontWeight: '700' },
  field: { alignSelf: 'stretch', marginBottom: 16 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', marginBottom: 8 },
  input: { alignSelf: 'stretch', width: '100%', minWidth: 0, height: 56, borderRadius: 14, paddingHorizontal: 18, fontSize: 17, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, marginTop: -4, marginBottom: 18 },
  notice: { color: '#FFD4C8', textAlign: 'center', marginBottom: 12 },
  cta: { alignSelf: 'stretch', height: 56, borderRadius: 999, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#000', fontSize: 18, fontWeight: '700' },
  linkBtn: { alignSelf: 'center', paddingVertical: 12, marginTop: 6 },
  link: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  legalLink: { color: 'white', fontWeight: '700', textDecorationLine: 'underline' },
  legalSmall: { color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center' },
});
