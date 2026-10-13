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
};

const syncing = new Set<string>();

export const useWardrobe = create<WardrobeState>()(persist((set, get) => ({
  saved: DEFAULT_OUTFIT,
  savedAt: null,
  unlocked: [],
  ownerId: null,
  history: startHistory(DEFAULT_OUTFIT),
  gender: 'male',
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
  save: userId => {
    const { history, unlocked, saved } = get();
    const dropped = unownedItems(history.present, WARDROBE_ITEMS, unlocked);
    const clean = sanitizeOutfit(history.present, WARDROBE_ITEMS, unlocked, saved);
    const savedAt = new Date().toISOString();
    set({ saved: clean, savedAt, ownerId: userId, history: { ...history, present: clean } });
    if (userId) void pushRemoteOutfit(userId, clean, unlocked, savedAt);
    return { outfit: clean, dropped };
  },
  sync: async userId => {
    if (!userId || syncing.has(userId)) return;
    syncing.add(userId);
    try {
      if (get().ownerId && get().ownerId !== userId) { const start = defaultOutfitFor(get().gender); set({ saved: start, savedAt: null, unlocked: [], ownerId: userId, history: startHistory(start) }); }
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
  applyAppearance: (userId, appearance, fields) => {
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
  partialize: state => ({ saved: state.saved, savedAt: state.savedAt, unlocked: state.unlocked, ownerId: state.ownerId, gender: state.gender }),
  // v1 had no savedAt/ownerId: an existing v1 save counts as an (old) explicit save.
  migrate: (persisted, version) => {
    const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
    if (version < 2) return { ...p, savedAt: p.saved ? new Date(0).toISOString() : null, ownerId: null };
    return p;
  },
  merge: (persisted, current) => {
    const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<Pick<WardrobeState, 'saved' | 'unlocked' | 'savedAt' | 'ownerId' | 'gender'>>;
    const unlocked = Array.isArray(p.unlocked) ? p.unlocked.filter((id): id is string => typeof id === 'string') : [];
    const gender: Gender = isGender(p.gender) ? p.gender : 'male';
    const saved = p.saved ? parseOutfit(p.saved, WARDROBE_ITEMS) : defaultOutfitFor(gender);
    return { ...current, gender, saved, history: startHistory(saved), savedAt: typeof p.savedAt === 'string' ? p.savedAt : null, unlocked, ownerId: typeof p.ownerId === 'string' ? p.ownerId : null };
  },
}));

/** True when this account has an explicitly saved outfit on this device (or synced from the account). */
export function hasSavedOutfit(state: Pick<WardrobeState, 'savedAt' | 'ownerId'>, userId: string | null | undefined): boolean {
  return state.savedAt != null && (state.ownerId == null || state.ownerId === userId);
}
