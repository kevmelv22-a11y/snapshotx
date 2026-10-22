/** Chat-feed settings per account (pins + "Wissen uit chatfeed"). Device-local (AsyncStorage) — no server table. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EMPTY_FEED, clearFromFeed, pruneCleared, togglePin, type FeedPrefs } from '../lib/chat-feed-prefs';

type FeedState = {
  byUser: Record<string, FeedPrefs>;
  togglePin: (uid: string, id: string) => string | null;
  clear: (uid: string, id: string) => void;
  unclear: (uid: string, id: string) => void;
  prune: (uid: string, rows: { id: string; createdAt: string | null }[]) => void;
};

export const useChatFeed = create<FeedState>()(persist((set, get) => ({
  byUser: {},
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
}), { name: 'sx-chat-feed', storage: createJSONStorage(() => AsyncStorage), partialize: s => ({ byUser: s.byUser }) }));
