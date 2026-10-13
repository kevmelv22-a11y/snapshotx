import React, {useCallback, useEffect, useState} from 'react';
import {Modal} from 'react-native';
import {Stack, useFocusEffect} from 'expo-router';
import {Media} from '../components/Media';
import {MemoriesView, MemoryDetail, type ResendTarget} from '../components/memories/MemoriesView';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {dayKey, registerPinAttempt, sectionTitle, togglePrivate, validatePin, type Memory, type PinLock} from '../lib/memories';
import {checkVaultPin, loadMemories, resendMemory, setMemoryPrivate, setVaultPin, vaultHasPin} from '../lib/memories-store';

export default function MemoriesScreen() {
  const {session} = useSession();
  const uid = session?.user.id;
  const [items, setItems] = useState<Memory[]>([]);
  const [tab, setTab] = useState<'all' | 'private'>('all');
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState(true);
  const [lock, setLock] = useState<PinLock>({failures: 0, lockedUntil: null});
  const [pinError, setPinError] = useState('');
  const [open, setOpen] = useState<Memory | null>(null);
  const [targets, setTargets] = useState<ResendTarget[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tz = new Date().getTimezoneOffset();

  const load = useCallback(async () => {
    if (!uid) return;
    try { setItems(await loadMemories(uid)); setHasPin(await vaultHasPin(uid)); } catch (e) { setNotice((e as Error).message); }
  }, [uid]);
  useFocusEffect(useCallback(() => { void load(); return () => setUnlocked(false); }, [load]));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!uid || !open) return; void (async () => {
    const f = await supabase.from('sx_friends').select('friend_id').eq('user_id', uid);
    const ids = (f.data || []).map(x => x.friend_id); if (!ids.length) return;
    const p = await supabase.from('profiles').select('id,display_name,username').in('id', ids);
    setTargets((p.data || []).map(x => ({id: x.id, name: x.display_name || x.username || 'Vriend'})));
  })(); }, [open, uid]);

  async function submitPin(pin: string) {
    if (!uid) return;
    setPinError('');
    try {
      if (!hasPin) { const err = validatePin(pin); if (err) { setPinError(err); return; } await setVaultPin(uid, pin); setHasPin(true); setUnlocked(true); setNotice('Pincode ingesteld.'); return; }
      const ok = await checkVaultPin(uid, pin);
      setLock(l => registerPinAttempt(l, ok, Date.now()));
      if (ok) setUnlocked(true);
    } catch (e) { setPinError((e as Error).message); }
  }
  async function resend(ids: string[]) {
    if (!uid || !open) return; setBusy(true);
    try { await resendMemory(open, uid, ids); setOpen(null); setNotice(`Verstuurd naar ${ids.length} vriend${ids.length === 1 ? '' : 'en'}.`); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  }
  async function togglePriv() {
    if (!open) return; setBusy(true);
    if (!open.private && !hasPin) { setNotice('Stel eerst een pincode in via Alleen voor mij.'); setBusy(false); return; }
    try { await setMemoryPrivate(open.id, !open.private); setItems(list => togglePrivate(list, open.id, !open.private)); setOpen(null); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  }
  const thumb = (m: Memory, style: any) => <Media path={m.storage_path} type={m.media_type} style={style}/>;
  return <>
    <Stack.Screen options={{title: 'Herinneringen'}}/>
    <MemoriesView memories={items} now={now} tzOffsetMin={tz} renderThumb={thumb} tab={tab} onTab={t => { setTab(t); setPinError(''); }} vaultUnlocked={unlocked} hasPin={hasPin} lock={lock} pinError={pinError} onSubmitPin={p => void submitPin(p)} onOpen={setOpen} notice={notice}/>
    <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
      {open && <MemoryDetail memory={open} title={sectionTitle(dayKey(open.created_at, tz), dayKey(new Date(now).toISOString(), tz))} renderThumb={thumb} targets={targets} busy={busy} onResend={ids => void resend(ids)} onTogglePrivate={() => void togglePriv()} onClose={() => setOpen(null)}/>}
    </Modal>
  </>;
}
