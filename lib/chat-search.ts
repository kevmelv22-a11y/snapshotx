/**
 * "Zoeken in chat": find text in the loaded messages of one chat (newest first, like the list), jump between hits.
 * Searches what the chat SHOWS: reply prefix removed, sticker tokens → their label, polls by question + answers.
 * Snaps, media and system lines are skipped. Case- and accent-insensitive ("cafe" finds "café").
 */
import { parseReply } from './chat-replies';
import { parsePoll } from './chat-polls';
import { chatPreviewText } from './avatar/poses';

export const CHAT_SEARCH_TEXT = { placeholder: 'Zoeken in chat', none: 'Geen resultaten', open: 'Zoeken in chat', close: 'Zoeken sluiten', prev: 'Vorige', next: 'Volgende' } as const;

export type SearchableMessage = { id: string; kind: string; body: string | null; unsent_at?: string | null };

export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL');

export function searchableText(m: SearchableMessage): string {
  if (m.kind !== 'text' || m.unsent_at || !m.body) return '';
  const poll = parsePoll(m.body);
  if (poll) return [poll.question, ...poll.options].join(' ');
  return chatPreviewText(parseReply(m.body)?.text ?? m.body);
}

/** Ids of matching messages in list order (rows are newest first). Queries under 2 characters find nothing. */
export function searchChat(rows: readonly SearchableMessage[], query: string): string[] {
  const q = fold(query.trim());
  if ([...q].length < 2) return [];
  return rows.filter(m => fold(searchableText(m)).includes(q)).map(m => m.id);
}

/** Step through hits: index 0 = newest. 'older' goes up the chat. Wraps around. */
export function stepHit(count: number, index: number, dir: 'older' | 'newer'): number {
  if (count <= 0) return -1;
  if (index < 0) return 0;
  return dir === 'older' ? (index + 1) % count : (index - 1 + count) % count;
}

/** "2 van 5" / "Geen resultaten" / '' (no query yet). */
export function hitLabel(count: number, index: number, query: string): string {
  if ([...query.trim()].length < 2) return '';
  return count ? `${Math.min(count, Math.max(1, index + 1))} van ${count}` : CHAT_SEARCH_TEXT.none;
}
