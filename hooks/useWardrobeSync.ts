import { useEffect, useState } from 'react';
import type { Outfit } from '../lib/avatar/outfit';
import { hasSavedOutfit, useWardrobe } from '../stores/wardrobe';

const lastRun = new Map<string, number>();
const THROTTLE_MS = 30_000;

function whenHydrated(run: () => void): () => void {
  if (useWardrobe.persist.hasHydrated()) { run(); return () => {}; }
  return useWardrobe.persist.onFinishHydration(() => run());
}

/**
 * Reconciles the local wardrobe with the account copy (newest save wins) once the local copy is loaded.
 * Fire-and-forget: never blocks rendering; failures fall back to local-only (warned in outfitSync).
 */
export function useWardrobeSync(userId: string | null | undefined, { force = false }: { force?: boolean } = {}) {
  useEffect(() => {
    if (!userId) return;
    return whenHydrated(() => {
      const now = Date.now();
      if (!force && now - (lastRun.get(userId) ?? 0) < THROTTLE_MS) return;
      lastRun.set(userId, now);
      void useWardrobe.getState().sync(userId);
    });
  }, [userId, force]);
}

/** True once the local (AsyncStorage) copy has been loaded. */
export function useWardrobeHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useWardrobe.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useWardrobe.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

/** The saved wardrobe outfit for this account, or null when none was saved (show the classic avatar). */
export function useOwnOutfit(userId: string | null | undefined): Outfit | null {
  const saved = useWardrobe(state => state.saved);
  const has = useWardrobe(state => hasSavedOutfit(state, userId));
  return has ? saved : null;
}
