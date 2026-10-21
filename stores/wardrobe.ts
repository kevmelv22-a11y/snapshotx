import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_OUTFIT, defaultOutfitFor, isGender, parseOutfit, pushHistory, reconcile, redoHistory, sanitizeOutfit, startHistory, undoHistory, unownedItems,
  type Gender, type Outfit, type OutfitHistory,
} from '../lib/avatar/outfit';
import type { AvatarAppearance } from '../lib/avatar';
import { mergeAppearance, type AppearanceField } from '../lib/avatar/appearance';
import { fetchRemoteOutfit, pushRemoteOutfit } from '../lib/avatar/outfitSync';
import { WARDROBE_ITEMS, type WardrobeItem } from '../lib/avatar/wardrobeItems';

/**
 * Avatarkast (wardrobe) state. Persisted locally (AsyncStorage): `saved`, `savedAt`, `unlocked`, `ownerId`.
 * Account sync is best-effort on top of that (see lib/avatar/outfitSync.ts): local first, remote second.
 * Draft + undo/redo history live in memory while the editor is open.
 */
type WardrobeState = {
  saved: Outfit;
  /** ISO time of the last explicit save; null = never saved (callers fall back to the classic avatar). */
  savedAt: string | null;
  /** Item ids unlocked through the MOCK purchase flow (no payment). */
  unlocked: string[];
  /** Account the local copy belongs to (a different login on this device starts fresh). */
  ownerId: string | null;
  history: OutfitHistory;
  /** Character set chosen at registration (profile/user metadata 'gender'); picks the male/female art + start look. */
  gender: Gender;
  /** Sets the character set. Without a saved outfit the start look of that set is used; a saved outfit keeps its clothes. */
  setGender: (gender: Gender) => void;
  begin: () => void;
  apply: (next: Outfit) => void;
  restore: (history: OutfitHistory) => void;
  undo: () => void;
  redo: () => void;
  unlock: (ids: string[]) => void;
  /** Saves the draft locally (unowned items stripped) and pushes it to the account in the background. */
  save: (userId: string | null) => { outfit: Outfit; dropped: WardrobeItem[] };
  /** Loads the account copy and reconciles (newest updatedAt wins). Never throws, never blocks. */
  sync: (userId: string | null) => Promise<void>;
  /**
   * The classic editor (/avatar-editor) saved skin / hair colour / hairstyle: merge the touched fields
   * into the saved outfit as a new save (latest edit wins, see lib/avatar/appearance.ts). Clothes stay.
   * No-op (false) when this account has no saved outfit: the classic art already shows the edit.
   */
  applyAppearance: (userId: string | null, appearance: AvatarAppearance, fields: readonly AppearanceField[]) => boolean;
  /** Other accounts' local copies on this device, by owner key. */
  accounts: Record<string, AccountWardrobe>;
  /** Signed-in account changed (or its gender is known): stash the previous account, load this one or its gender default. */
  switchUser: (user: { id: string; user_metadata?: Record<string, unknown> }, gender: Gender | null) => void;
};

const syncing = new Set<string>();

/** Per-account local copy, so a second login on this device never sees (or starts from) another account's look. */
export type AccountWardrobe = { saved: Outfit; savedAt: string | null; unlocked: string[]; gender: Gender };

/**
 * Wardrobe owner key for an auth user. Real accounts: the user id. The demo backend signs every demo account in
 * as the same mock user id, so a demo registration carries `user_metadata.demo_account` to keep looks apart.
 */
export function wardrobeKeyFor(user: { id: string; user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  if (!user) return null;
  const d = user.user_metadata?.demo_account;
  return typeof d === 'string' && d ? `${user.id}#${d}` : user.id;
}
let alias: { uid: string; key: string } | null = null;
/** Maps the session user id that screens pass around to the wardrobe owner key (identity outside the demo). */
export const ownerKey = (userId: string | null | undefined): string | null => userId ? (alias?.uid === userId ? alias.key : userId) : null;


export const useWardrobe = create<WardrobeState>()(persist((set, get) => ({
  saved: DEFAULT_OUTFIT,
  savedAt: null,
  unlocked: [],
  ownerId: null,
  history: startHistory(DEFAULT_OUTFIT),
  gender: 'male',
  accounts: {},
  switchUser: (user, gender) => {
    const key = wardrobeKeyFor(user)!;
    alias = { uid: user.id, key };
    const state = get();
    if (state.ownerId === key || state.ownerId == null) { // same account, or an unclaimed (legacy) local copy
      // Always set: the alias above changes what hasSavedOutfit() answers, so subscribed screens must re-run.
      set({ ownerId: key });
      if (gender) get().setGender(gender);
      return;
    }
    const accounts = { ...state.accounts };
    if (state.ownerId) accounts[state.ownerId] = { saved: state.saved, savedAt: state.savedAt, unlocked: state.unlocked, gender: state.gender };
    const mine = accounts[key];
    delete accounts[key];
    const g: Gender = gender ?? mine?.gender ?? 'male';
    const saved = mine ? { ...mine.saved, gender: g } : defaultOutfitFor(g);
    set({ accounts, ownerId: key, gender: g, saved, savedAt: mine?.savedAt ?? null, unlocked: mine?.unlocked ?? [], history: startHistory(saved) });
  },
  setGender: gender => set(state => {
    if (state.gender === gender && (state.saved.gender ?? 'male') === gender) return {};
    const saved = state.savedAt ? { ...state.saved, gender } : defaultOutfitFor(gender);
    return { gender, saved, history: startHistory(saved) };
  }),
  begin: () => set(state => ({ history: startHistory(state.saved) })),
  apply: next => set(state => ({ history: pushHistory(state.history, { ...next, gender: state.gender }) })),
  restore: history => set({ history }),
  undo: () => set(state => ({ history: undoHistory(state.history) })),
  redo: () => set(state => ({ history: redoHistory(state.history) })),
  unlock: ids => {
    set(state => ({ unlocked: [...new Set([...state.unlocked, ...ids])] }));
    const { ownerId, saved, unlocked, savedAt } = get();
    // Unlocks reach the account with the next save if nothing was saved yet (keeps the classic avatar as fallback elsewhere).
    if (ownerId && savedAt) void pushRemoteOutfit(ownerId, saved, unlocked, savedAt);
  },
  save: uid => {
    const userId = ownerKey(uid);
    const { history, unlocked, saved } = get();
    const dropped = unownedItems(history.present, WARDROBE_ITEMS, unlocked);
    const clean = sanitizeOutfit(history.present, WARDROBE_ITEMS, unlocked, saved);
    const savedAt = new Date().toISOString();
    set({ saved: clean, savedAt, ownerId: userId, history: { ...history, present: clean } });
    if (userId) void pushRemoteOutfit(userId, clean, unlocked, savedAt);
    return { outfit: clean, dropped };
  },
  sync: async uid => {
    const userId = ownerKey(uid);
    if (!userId || syncing.has(userId)) return;
    syncing.add(userId);
    try {
      if (get().ownerId !== userId) get().switchUser({ id: userId }, null);
      const remote = await fetchRemoteOutfit(userId);
      if (remote === undefined) return;
      const state = get();
      const merged = reconcile({ outfit: state.saved, unlocked: state.unlocked, updatedAt: state.savedAt }, remote);
      const editing = state.history.past.length > 0 || state.history.future.length > 0;
      set({
        saved: merged.outfit, savedAt: merged.updatedAt, unlocked: merged.unlocked, ownerId: userId,
        // Only refresh the draft if the user hasn't started editing it.
        ...(merged.source === 'remote' && !editing ? { history: startHistory(merged.outfit) } : {}),
      });
      if (merged.push) await pushRemoteOutfit(userId, merged.outfit, merged.unlocked, merged.updatedAt ?? new Date(0).toISOString());
    } finally {
      syncing.delete(userId);
    }
  },
  applyAppearance: (uid, appearance, fields) => {
    const userId = ownerKey(uid);
    const state = get();
    if (!fields.length || !hasSavedOutfit(state, userId)) return false;
    const outfit = mergeAppearance(state.saved, appearance, fields);
    const savedAt = new Date().toISOString();
    set({ saved: outfit, savedAt, ownerId: userId ?? state.ownerId, history: startHistory(outfit) });
    if (userId) void pushRemoteOutfit(userId, outfit, state.unlocked, savedAt);
    return true;
  },
}), {
  name: 'snapshotx.wardrobe.v1',
  version: 2,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: state => ({ saved: state.saved, savedAt: state.savedAt, unlocked: state.unlocked, ownerId: state.ownerId, gender: state.gender, accounts: state.accounts }),
  // v1 had no savedAt/ownerId: an existing v1 save counts as an (old) explicit save.
  migrate: (persisted, version) => {
    const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
    if (version < 2) return { ...p, savedAt: p.saved ? new Date(0).toISOString() : null, ownerId: null };
    return p;
  },
  merge: (persisted, current) => {
    const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<Pick<WardrobeState, 'saved' | 'unlocked' | 'savedAt' | 'ownerId' | 'gender' | 'accounts'>>;
    const accounts: Record<string, AccountWardrobe> = {};
    for (const [k, a] of Object.entries(p.accounts && typeof p.accounts === 'object' ? p.accounts : {})) {
      if (!a || typeof a !== 'object') continue;
      const g: Gender = isGender(a.gender) ? a.gender : 'male';
      accounts[k] = { gender: g, saved: a.saved ? parseOutfit(a.saved, WARDROBE_ITEMS) : defaultOutfitFor(g), savedAt: typeof a.savedAt === 'string' ? a.savedAt : null, unlocked: Array.isArray(a.unlocked) ? a.unlocked.filter((id): id is string => typeof id === 'string') : [] };
    }
    const unlocked = Array.isArray(p.unlocked) ? p.unlocked.filter((id): id is string => typeof id === 'string') : [];
    const gender: Gender = isGender(p.gender) ? p.gender : 'male';
    const saved = p.saved ? parseOutfit(p.saved, WARDROBE_ITEMS) : defaultOutfitFor(gender);
    return { ...current, gender, saved, history: startHistory(saved), savedAt: typeof p.savedAt === 'string' ? p.savedAt : null, unlocked, ownerId: typeof p.ownerId === 'string' ? p.ownerId : null, accounts };
  },
}));

/** True when this account has an explicitly saved outfit on this device (or synced from the account). */
export function hasSavedOutfit(state: Pick<WardrobeState, 'savedAt' | 'ownerId'>, userId: string | null | undefined): boolean {
  const key = ownerKey(userId);
  return state.savedAt != null && (state.ownerId == null || state.ownerId === key);
}
