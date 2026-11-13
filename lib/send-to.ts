/** Snapchat "Verzenden naar" sheet: search, Mijn verhaal + friends in one selection, blue send bar summary. */
export type SendFriend = { id: string; display_name: string };
export const STORY_TARGET = 'story:mine';

export function filterFriends<T extends SendFriend>(list: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('nl');
  const sorted = [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, 'nl'));
  return q ? sorted.filter(f => f.display_name.toLocaleLowerCase('nl').includes(q)) : sorted;
}

export function toggleTarget(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
}

/** Bottom bar text: "Mijn verhaal, Aria, Milan +2" (empty string when nothing chosen). */
export function sendSummary(selected: string[], friends: SendFriend[], max = 3): string {
  const names = selected.map(id => id === STORY_TARGET ? 'Mijn verhaal' : friends.find(f => f.id === id)?.display_name).filter((x): x is string => !!x);
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}

export function splitTargets(selected: string[]): { story: boolean; friendIds: string[] } {
  return { story: selected.includes(STORY_TARGET), friendIds: selected.filter(x => x !== STORY_TARGET) };
}
