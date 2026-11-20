/** Mijn AI chat history per account, on this device only (AsyncStorage). Never synced to a server table. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appendCapped, type AiMessage } from '../lib/my-ai';

type State = {
  byUser: Record<string, AiMessage[]>;
  add: (uid: string, ...m: AiMessage[]) => void;
  markFailed: (uid: string, id: string) => void;
  clear: (uid: string) => void;
};
export const useMyAi = create<State>()(persist(set => ({
  byUser: {},
  add: (uid, ...m) => set(s => ({ byUser: { ...s.byUser, [uid]: appendCapped(s.byUser[uid] ?? [], ...m) } })),
  markFailed: (uid, id) => set(s => ({ byUser: { ...s.byUser, [uid]: (s.byUser[uid] ?? []).map(x => (x.id === id ? { ...x, failed: true } : x)) } })),
  clear: uid => set(s => ({ byUser: { ...s.byUser, [uid]: [] } })),
}), { name: 'sx-my-ai', storage: createJSONStorage(() => AsyncStorage) }));
