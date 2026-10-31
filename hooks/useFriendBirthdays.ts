import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BIRTHDAY_RPC, birthdayFriendIds, type FriendBirthdayRow } from '../lib/friend-birthdays';

/** Rows per friend id (shared by friends tab, chat list and Vriendschapsprofiel), refreshed after 10 minutes. */
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { row: FriendBirthdayRow | null; at: number }>();
let unavailable = false; // RPC not deployed (migration not applied): stop asking for this app session

async function fetchMissing(ids: string[]): Promise<boolean> {
  const now = Date.now(), need = ids.filter(id => (cache.get(id)?.at ?? 0) < now - TTL_MS);
  if (!need.length || unavailable) return false;
  try {
    const { data, error } = await supabase.rpc(BIRTHDAY_RPC, { p_ids: need });
    if (error) { unavailable = true; return false; }
    const rows = Array.isArray(data) ? (data as FriendBirthdayRow[]) : [];
    for (const id of need) cache.set(id, { row: rows.find(r => r?.user_id === id) ?? null, at: now });
    return true;
  } catch { unavailable = true; return false; }
}

/** Ids of the given friends who are jarig today with Verjaardagsfeest on (→ show 🎂). Empty when unavailable. */
export function useFriendBirthdays(ids: readonly (string | null | undefined)[]): ReadonlySet<string> {
  const key = [...new Set(ids.filter((id): id is string => !!id))].sort().join(',');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void fetchMissing(key.split(',')).then(changed => { if (alive && changed) setVersion(v => v + 1); });
    return () => { alive = false; };
  }, [key]);
  return useMemo(() => {
    void version;
    return birthdayFriendIds(key ? key.split(',').map(id => cache.get(id)?.row).filter((r): r is FriendBirthdayRow => !!r) : []);
  }, [key, version]);
}
