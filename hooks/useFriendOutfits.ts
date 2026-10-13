import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { createFriendOutfitCache, createRefreshLoop } from '../lib/avatar/friendOutfits';
import { WARDROBE_ITEMS } from '../lib/avatar/wardrobeItems';
import { parseOutfit, type Outfit } from '../lib/avatar/outfit';
import { fetchFriendOutfits } from '../lib/avatar/outfitSync';
import { useSession } from './useSession';

/** How often open friends/chats/map screens re-check friends' outfits (only while focused + in the foreground). */
export const FRIEND_OUTFIT_POLL_MS = 60_000;

/**
 * App-wide cache of friends' saved avatarkast outfits (RPC sx_friend_avatar_outfits), shared by all screens so
 * the chats list, the map and the friends tab batch into one RPC call.
 * - Fresh for 60 s (TTL); screens additionally refresh on focus, on return to the foreground and every 60 s.
 * - Persisted per signed-in user in AsyncStorage (`snapshotx.friendOutfits.v1:<userId>`), so after an app start
 *   the last known outfits are on screen right away (then refreshed in the background). Until that blob is
 *   read (a few ms) or, without a stored value, until the first fetch returns, a friend shows a neutral
 *   placeholder (`'pending'`) instead of the classic art, so the old art never flashes.
 * - Logout clears memory + storage; prune() (friend list loads) drops people that are no longer friends.
 * - Supabase realtime is deliberately NOT used: sx_avatar_outfits is owner-only under RLS, so realtime could
 *   not deliver friends' rows without widening the select policy (which would expose unlocked_item_ids).
 */
export const friendOutfitCache = createFriendOutfitCache<Outfit>(fetchFriendOutfits, {
  storage: AsyncStorage,
  revive: raw => parseOutfit(raw, WARDROBE_ITEMS),
});

/** Outfit to render, or 'pending' (neutral placeholder). Missing id => classic art. */
export type FriendOutfitValue = Outfit | 'pending';

/** Mount once inside SessionProvider: keeps the cache's owner in sync with the signed-in user (logout clears it). */
export function FriendOutfitOwnerSync(): null {
  const { session, ready } = useSession();
  const uid = session?.user?.id ?? null;
  useEffect(() => {
    if (!ready) return; // session (re)check in progress: keep the current owner, don't clear anything yet
    void friendOutfitCache.setOwner(uid);
  }, [ready, uid]);
  return null;
}

function collect(key: string, _version: number): ReadonlyMap<string, FriendOutfitValue> {
  const out = new Map<string, FriendOutfitValue>();
  if (!key) return out;
  for (const id of key.split(',')) {
    const status = friendOutfitCache.status(id);
    if (status === 'pending') out.set(id, 'pending');
    else if (status === 'outfit') { const outfit = friendOutfitCache.get(id); if (outfit) out.set(id, outfit); }
  }
  return out;
}

/**
 * Saved outfits for the given friend ids: Outfit, 'pending' (show a neutral placeholder) or missing (classic
 * art; also covers "migration not applied": one console warning from outfitSync, no errors).
 * With `live` (friends/chats/map screens) the ids are refreshed on screen focus, when the app returns to the
 * foreground and every FRIEND_OUTFIT_POLL_MS while the screen is focused; nothing runs in the background.
 */
export function useFriendOutfits(ids: readonly (string | null | undefined)[], opts: { live?: boolean } = {}): ReadonlyMap<string, FriendOutfitValue> {
  const key = [...new Set(ids.filter((id): id is string => !!id))].sort().join(',');
  const keyRef = useRef(key);
  keyRef.current = key;
  const live = !!opts.live;
  // Live screens revalidate ids as soon as they appear (screen opened / list loaded), throttled to once per 5 s;
  // other users of the hook only fetch unknown ids or ids older than the 60 s TTL.
  useEffect(() => {
    if (!key) return;
    if (live) friendOutfitCache.refresh(key.split(','));
    else friendOutfitCache.request(key.split(','));
  }, [key, live]);

  const loop = useMemo(() => live ? createRefreshLoop(() => { if (keyRef.current) friendOutfitCache.refresh(keyRef.current.split(',')); }, { intervalMs: FRIEND_OUTFIT_POLL_MS, foreground: AppState.currentState !== 'background' }) : null, [live]);
  useEffect(() => {
    if (!loop) return;
    const sub = AppState.addEventListener('change', state => loop.setForeground(state === 'active'));
    return () => { sub.remove(); loop.stop(); };
  }, [loop]);
  useFocusEffect(useCallback(() => {
    loop?.setFocused(true);
    return () => loop?.setFocused(false);
  }, [loop]));

  const version = useSyncExternalStore(friendOutfitCache.subscribe, friendOutfitCache.version, friendOutfitCache.version);
  return useMemo(() => collect(key, version), [key, version]);
}
