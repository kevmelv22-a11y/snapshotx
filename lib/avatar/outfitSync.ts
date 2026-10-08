/**
 * Account sync for the Bitmoji-kast (table public.sx_avatar_outfits, see
 * supabase/migrations/20261007150000_avatar_outfits.sql). Local-first: every failure (table not
 * migrated yet, offline, RLS, ...) is swallowed with one console warning and the app keeps working
 * from AsyncStorage. Nothing here touches payments: unlocked ids come from the MOCK purchase flow.
 */
import { supabase } from '../supabase';
import { fetchInChunks, parseFriendRows } from './friendOutfits';
import { parseOutfit, type Outfit, type SyncSnapshot } from './outfit';
import { WARDROBE_ITEMS } from './wardrobeItems';

export const OUTFIT_TABLE = 'sx_avatar_outfits';
const ID_RE = /^[a-z0-9-]{1,80}$/;

let warned = false;
function warnOnce(action: string, message: string) {
  if (warned) return;
  warned = true;
  console.warn(`[bitmoji-kast] Accountsync niet beschikbaar (${action}): ${message}. Outfit blijft lokaal opgeslagen; vrienden zonder gesynchroniseerde outfit tonen de klassieke avatar.`);
}

type Row = { outfit: unknown; unlocked_item_ids: unknown; updated_at: string | null };

function toSnapshot(row: Row): SyncSnapshot {
  const unlocked = Array.isArray(row.unlocked_item_ids) ? row.unlocked_item_ids.filter((id): id is string => typeof id === 'string' && ID_RE.test(id)) : [];
  return { outfit: parseOutfit(row.outfit, WARDROBE_ITEMS), unlocked, updatedAt: row.updated_at };
}

/** null = no row yet; undefined = sync unavailable (error already warned). Never throws. */
export async function fetchRemoteOutfit(userId: string): Promise<SyncSnapshot | null | undefined> {
  try {
    const { data, error } = await supabase.from(OUTFIT_TABLE).select('outfit,unlocked_item_ids,updated_at').eq('user_id', userId).maybeSingle();
    if (error) { warnOnce('laden', error.message); return undefined; }
    return data ? toSnapshot(data as Row) : null;
  } catch (e) {
    warnOnce('laden', e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

/** Upserts the own row. Returns false when sync is unavailable. Never throws. */
export async function pushRemoteOutfit(userId: string, outfit: Outfit, unlocked: string[], updatedAt: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(OUTFIT_TABLE).upsert({
      user_id: userId,
      outfit,
      unlocked_item_ids: unlocked.filter(id => ID_RE.test(id)).slice(0, 500),
      updated_at: updatedAt,
    }, { onConflict: 'user_id' });
    if (error) { warnOnce('opslaan', error.message); return false; }
    return true;
  } catch (e) {
    warnOnce('opslaan', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Friends' saved outfits via the security-definer RPC (returns outfit + updated_at only, never unlocks).
 * Returns undefined when the RPC/table is unavailable (one warning, shared with the own-outfit sync),
 * otherwise a Map with the friends that have a saved outfit. Never throws.
 * Used through the batched in-memory cache in hooks/useFriendOutfits.ts.
 */
export async function fetchFriendOutfits(userIds: string[]): Promise<Map<string, Outfit> | undefined> {
  if (!userIds.length) return new Map();
  try {
    // The RPC rejects more than 200 ids with an error (never silently drops them); the cache already batches
    // at 200, and fetchInChunks keeps any caller safe. An error => undefined => back off, nothing cached.
    return await fetchInChunks(userIds, async chunk => {
      const { data, error } = await supabase.rpc('sx_friend_avatar_outfits', { p_user_ids: chunk });
      if (error) warnOnce('vrienden', error.message);
      return parseFriendRows(data, error, outfit => parseOutfit(outfit, WARDROBE_ITEMS));
    });
  } catch (e) {
    warnOnce('vrienden', e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
