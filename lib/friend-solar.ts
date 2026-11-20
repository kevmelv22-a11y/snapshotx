/** Snapchat+ "Vriendschapszonnestelsel": on a friend's profile, which planet YOU are in THEIR best-friends list.
 *  Source = public.sx_friend_ranks (20261120070000, read-only): only my own rank (1..8) in their ranking, never who else
 *  is in it. Snapshot X+ only; without X+ a teaser to /plus. Pure + unit-tested. */
import { BEST_FRIENDS_MAX } from './friend-emojis';

export type Planet = { rank: number; name: string; color: string; size: number };
/** Closest to the sun = #1 best friend (Mercurius … Neptunus). */
export const PLANETS: readonly Planet[] = [
  { rank: 1, name: 'Mercurius', color: '#B7B0A8', size: 12 },
  { rank: 2, name: 'Venus', color: '#E8C27A', size: 15 },
  { rank: 3, name: 'Aarde', color: '#3FA9F5', size: 16 },
  { rank: 4, name: 'Mars', color: '#E0603A', size: 13 },
  { rank: 5, name: 'Jupiter', color: '#D9A066', size: 24 },
  { rank: 6, name: 'Saturnus', color: '#E5CF8B', size: 21 },
  { rank: 7, name: 'Uranus', color: '#7FE0E0', size: 18 },
  { rank: 8, name: 'Neptunus', color: '#4D6CF5', size: 18 },
];
export const SOLAR_TEXT = {
  title: 'Zonnestelsel',
  plusOnly: 'Zie welke planeet jij bent in het zonnestelsel van je vriend — met Snapshot X+.',
  plusCta: 'Ontdek Snapshot X+',
  none: (first: string) => `Je staat (nog) niet in de beste vrienden van ${first}. Snap en chat vaker met elkaar!`,
  note: 'Gebaseerd op jullie snaps en chats van de afgelopen 7 dagen. Alleen jij ziet je eigen planeet.',
} as const;

export function planetFor(rank: number | null | undefined): Planet | null {
  return typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= BEST_FRIENDS_MAX ? PLANETS[rank - 1] : null;
}
/** Main line under the orbit, e.g. "Jij bent Venus 🪐 — #2 bij Eva". */
export function solarLine(rank: number | null | undefined, friendName: string): string {
  const first = (friendName || '').trim().split(/\s+/)[0] || 'je vriend';
  const p = planetFor(rank);
  return p ? `Jij bent ${p.name} 🪐 — #${p.rank} in de beste vrienden van ${first}` : SOLAR_TEXT.none(first);
}
