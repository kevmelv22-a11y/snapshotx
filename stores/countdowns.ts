/** Afteltimers per account. Device-local (AsyncStorage) like Vriend-emoji's — no server table, no migration. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { pruneFinished, type Countdown } from '../lib/countdowns';

type State = {
  byUser: Record<string, Countdown[]>;
  add: (uid: string, c: Omit<Countdown, 'id' | 'createdAt'>, now: number) => Countdown;
  update: (uid: string, id: string, c: Omit<Countdown, 'id' | 'createdAt'>) => void;
  remove: (uid: string, id: string) => void;
  prune: (uid: string, now: number) => void;
};

const newId = (now: number) => `cd_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useCountdowns = create<State>()(persist((set, get) => ({
  byUser: {},
  add: (uid, c, now) => {
    const item: Countdown = { ...c, id: newId(now), createdAt: now };
    set(s => ({ byUser: { ...s.byUser, [uid]: [...(s.byUser[uid] ?? []), item] } }));
    return item;
  },
  update: (uid, id, c) => set(s => ({ byUser: { ...s.byUser, [uid]: (s.byUser[uid] ?? []).map(x => x.id === id ? { ...x, ...c } : x) } })),
  remove: (uid, id) => set(s => ({ byUser: { ...s.byUser, [uid]: (s.byUser[uid] ?? []).filter(x => x.id !== id) } })),
  prune: (uid, now) => {
    const cur = get().byUser[uid] ?? [], next = pruneFinished(cur, now);
    if (next.length !== cur.length) set(s => ({ byUser: { ...s.byUser, [uid]: next } }));
  },
}), { name: 'sx-countdowns', storage: createJSONStorage(() => AsyncStorage), partialize: s => ({ byUser: s.byUser }) }));

const EMPTY: Countdown[] = [];
/** Stable selector (same array reference when nothing changed). */
export const useMyCountdowns = (uid: string | undefined) => useCountdowns(s => (uid && s.byUser[uid]) || EMPTY);
