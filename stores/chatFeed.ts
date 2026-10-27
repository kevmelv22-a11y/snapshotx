/** Chat-feed settings per account (pins + "Wissen uit chatfeed"). Device-local (AsyncStorage) — no server table. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EMPTY_FEED, clearFromFeed, pruneCleared, togglePin, type FeedPrefs } from '../lib/chat-feed-prefs';
import { muteRow, muteUntil, pruneMutes, setMute, type MuteMap, type MuteOption } from '../lib/chat-mute';
import { supabase } from '../lib/supabase';

type FeedState = {
  byUser: Record<string, FeedPrefs>;
  /** Berichtmeldingen per account: threadId -> ISO end or 'always' (lib/chat-mute.ts). */
  mutes: Record<string, MuteMap>;
  setMute: (uid: string, id: string, option: MuteOption) => void;
  togglePin: (uid: string, id: string) => string | null;
  clear: (uid: string, id: string) => void;
  unclear: (uid: string, id: string) => void;
  prune: (uid: string, rows: { id: string; createdAt: string | null }[]) => void;
};

export const useChatFeed = create<FeedState>()(persist((set, get) => ({
  byUser: {},
  mutes: {},
  setMute: (uid, id, option) => {
    const now = Date.now();
    set(s => ({ mutes: { ...s.mutes, [uid]: pruneMutes(setMute(s.mutes[uid], id, option, now), now) } }));
    // Best-effort server mirror so the push-message edge function skips silent chats
    // (needs migration 20261027120000_chat_mutes.sql; without it this errors and stays device-local).
    const row = muteRow(uid, id, muteUntil(option, now));
    void (row
      ? supabase.from('sx_thread_mutes').upsert(row, { onConflict: 'user_id,thread_id' })
      : supabase.from('sx_thread_mutes').delete().eq('user_id', uid).eq('thread_id', id)
    ).then(() => undefined, () => undefined);
  },
  togglePin: (uid, id) => {
    const r = togglePin(get().byUser[uid] ?? EMPTY_FEED, id);
    if (!r.error) set(s => ({ byUser: { ...s.byUser, [uid]: r.prefs } }));
    return r.error;
  },
  clear: (uid, id) => set(s => ({ byUser: { ...s.byUser, [uid]: clearFromFeed(s.byUser[uid] ?? EMPTY_FEED, id) } })),
  unclear: (uid, id) => set(s => { const cur = s.byUser[uid]; if (!cur?.cleared[id]) return s; const cleared = { ...cur.cleared }; delete cleared[id]; return { byUser: { ...s.byUser, [uid]: { ...cur, cleared } } }; }),
  prune: (uid, rows) => {
    const cur = get().byUser[uid];
    if (!cur) return;
    const next = pruneCleared(cur, rows);
    if (next !== cur) set(s => ({ byUser: { ...s.byUser, [uid]: next } }));
  },
}), { name: 'sx-chat-feed', storage: createJSONStorage(() => AsyncStorage), partialize: s => ({ byUser: s.byUser, mutes: s.mutes }) }));
