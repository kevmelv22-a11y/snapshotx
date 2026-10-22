/** Vriend-emoji's per account: the user's own emoji choices + the last computed relationship per friend (so the
 *  Vriendschapsprofiel can show it without re-reading every chat). Device-local (AsyncStorage) — no server table. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setChoice, type FriendEmojiChoices, type FriendEmojiKind, type RelationKind } from '../lib/friend-emojis';

type State = {
  choices: Record<string, FriendEmojiChoices>;
  relations: Record<string, Record<string, RelationKind>>;
  choose: (uid: string, kind: FriendEmojiKind, emoji: string | null) => void;
  reset: (uid: string) => void;
  setRelations: (uid: string, rel: Map<string, RelationKind>) => void;
};

export const useFriendEmojis = create<State>()(persist((set, get) => ({
  choices: {},
  relations: {},
  choose: (uid, kind, emoji) => set(s => ({ choices: { ...s.choices, [uid]: setChoice(s.choices[uid], kind, emoji) } })),
  reset: uid => set(s => ({ choices: { ...s.choices, [uid]: {} } })),
  setRelations: (uid, rel) => {
    const next = Object.fromEntries(rel), cur = get().relations[uid] ?? {};
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    set(s => ({ relations: { ...s.relations, [uid]: next } }));
  },
}), { name: 'sx-friend-emojis', storage: createJSONStorage(() => AsyncStorage), partialize: s => ({ choices: s.choices, relations: s.relations }) }));
