/** Lens browser logic (pure; only type imports so it runs under `node --test`). */
import type { PhotoFilter, PhotoFilterId } from './photo-filters';

export type LensTab = 'recent' | 'favorites' | 'forYou' | 'aesthetic' | 'looks' | 'world';
export const LENS_TABS: { id: LensTab; label: string; icon: string }[] = [
  { id: 'recent', label: 'Recent', icon: 'time-outline' },
  { id: 'favorites', label: 'Favorieten', icon: 'heart-outline' },
  { id: 'forYou', label: 'Voor jou', icon: 'sparkles' },
  { id: 'aesthetic', label: 'Esthetiek', icon: 'color-palette-outline' },
  { id: 'looks', label: 'Uiterlijk', icon: 'happy-outline' },
  { id: 'world', label: 'Wereld', icon: 'earth-outline' },
];
export const RECENT_LIMIT = 12;
export const FAVORITES_KEY = 'sx:filter:favorites';
export const RECENT_KEY = 'sx:filter:recent';

/** Lenses shown in the picker ("Origineel" = no lens, so it is not a tile). */
export const pickerLenses = (all: readonly PhotoFilter[]): PhotoFilter[] => all.filter((f) => f.id !== 'original');

/** Parses a stored id list: drops unknown ids and duplicates, never throws. */
export function parseStoredIds(raw: string | null | undefined, lenses: readonly PhotoFilter[]): PhotoFilterId[] {
  try {
    const list: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    const out: PhotoFilterId[] = [];
    for (const id of list) if (lenses.some((l) => l.id === id && id !== 'original') && !out.includes(id as PhotoFilterId)) out.push(id as PhotoFilterId);
    return out;
  } catch {
    return [];
  }
}

export function toggleFavorite(favorites: readonly PhotoFilterId[], id: PhotoFilterId): PhotoFilterId[] {
  return favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
}

/** Most recent first, unique, capped. "Origineel" is not a lens and is never recorded. */
export function pushRecent(recent: readonly PhotoFilterId[], id: PhotoFilterId, limit = RECENT_LIMIT): PhotoFilterId[] {
  if (id === 'original') return [...recent];
  return [id, ...recent.filter((x) => x !== id)].slice(0, limit);
}

/** Lower-case, accents removed ("Zonnebríl" -> "zonnebril"). */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Matches every search word against the lens name, id and Dutch keywords. */
export function searchLenses(query: string, lenses: readonly PhotoFilter[]): PhotoFilter[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...lenses];
  return lenses.filter((l) => {
    const hay = normalizeSearch(`${l.name} ${l.id} ${l.keywords}`);
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Demo view count, derived deterministically from the lens id (FNV-1a hash).
 * Display-only decoration: NOT real usage data.
 */
export function demoViewCount(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  // Log-uniform between 15 thousand and 120 billion.
  const t = (h % 10000) / 10000;
  return Math.round(Math.exp(Math.log(15e3) + t * (Math.log(120e9) - Math.log(15e3))));
}

/** Dutch short notation as in the reference: 15K, 785K, 72mln., 6,1miljard, 113miljard. */
export function formatViewCount(n: number): string {
  const short = (v: number) => (v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString().replace('.', ','));
  if (n >= 1e9) return `${short(n / 1e9)}miljard`;
  if (n >= 1e6) return `${short(n / 1e6)}mln.`;
  if (n >= 1e3) return `${short(n / 1e3)}K`;
  return String(n);
}

export function lensesForTab(tab: LensTab, lenses: readonly PhotoFilter[], state: { favorites: readonly PhotoFilterId[]; recent: readonly PhotoFilterId[] }): PhotoFilter[] {
  const byId = (ids: readonly PhotoFilterId[]) => ids.map((id) => lenses.find((l) => l.id === id)).filter((l): l is PhotoFilter => !!l);
  switch (tab) {
    case 'recent': return byId(state.recent);
    case 'favorites': return byId(state.favorites);
    case 'aesthetic': return lenses.filter((l) => l.kind === 'tint' || l.kind === 'frame');
    case 'looks': return lenses.filter((l) => l.kind === 'face');
    case 'world': return lenses.filter((l) => l.kind === 'world');
    case 'forYou':
    default: return [...lenses].sort((a, b) => demoViewCount(b.id) - demoViewCount(a.id));
  }
}
