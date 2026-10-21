import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './useSession';
import { supabase } from '../lib/supabase';
import { loadOwnProfile, ownIdentity, type OwnProfile, type ProfileClient } from '../lib/own-profile';

/**
 * Own profile for profile/settings/QR screens. `profile` is available immediately (from the session's sign-up
 * metadata) while `loading` is true, so screens never render an empty "@"; reloads when the screen gains focus.
 */
export function useOwnProfile(): { profile: OwnProfile | null; loading: boolean; reload: () => Promise<void>; setDisplayName: (name: string) => void } {
  const { session } = useSession();
  const user = session?.user ?? null;
  const [profile, setProfile] = useState<OwnProfile | null>(user ? ownIdentity(user, null, 'fallback') : null);
  const [loading, setLoading] = useState(!!user);
  const uid = user?.id;
  const reload = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    try { setProfile(await loadOwnProfile(supabase as unknown as ProfileClient, user)); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  useEffect(() => { if (user) setProfile(p => (p && p.id === user.id ? p : ownIdentity(user, null, 'fallback'))); else setProfile(null); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const setDisplayName = useCallback((name: string) => setProfile(p => (p ? { ...p, displayName: name } : p)), []);
  return { profile, loading, reload, setDisplayName };
}
