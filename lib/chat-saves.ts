/** Snapchat "Opslaan in chat": hold a chat message → "Opslaan in chat". A saved message gets a grey highlight,
 *  shows who saved it, and never disappears (it ignores the chat's Verwijderinstelling: Na bekijken / 24 uur).
 *  Only the person who saved it, or the original sender, can unsave it ("Niet meer opslaan"); after that the normal
 *  retention applies again. Server side: RPC public.sx_set_message_saved (migration 20261022150000_chat_saves.sql,
 *  NOT applied yet). Snaps and system lines cannot be saved. No I/O. */
import type { RetentionMode } from './chat-features';

export type SaveableMessage = { id: string; sender_id: string; kind: string; saved?: boolean | null; saved_by?: string | null };
export const SAVE_LABEL = { save: 'Opslaan in chat', unsave: 'Niet meer opslaan' } as const;
export const SAVE_ERRORS = {
  notFound: 'Dit bericht bestaat niet meer',
  notMember: 'Je zit niet (meer) in deze chat',
  notSaveable: 'Snaps en meldingen kun je niet opslaan in de chat',
  notYours: 'Alleen wie het bericht opsloeg of verstuurde kan het opslaan ongedaan maken',
} as const;

/** Text, photo, video, voice notes and avatar stickers can be saved; one-time snaps and system lines not. */
export function canSave(m: Pick<SaveableMessage, 'kind'>): boolean {
  return m.kind === 'text' || m.kind === 'photo' || m.kind === 'video' || m.kind === 'voice';
}
/** Who may unsave: the saver, the original sender, or anyone when the saver is unknown (legacy saved rows). */
export function canUnsave(m: SaveableMessage, me: string): boolean {
  if (!m.saved) return false;
  return !m.saved_by || m.saved_by === me || m.sender_id === me;
}
/** Long-press menu entry for this message, or null when there is nothing to do. */
export function saveAction(m: SaveableMessage, me: string): 'save' | 'unsave' | null {
  if (!canSave(m)) return null;
  if (!m.saved) return 'save';
  return canUnsave(m, me) ? 'unsave' : null;
}
/** Label under a saved bubble: "Opgeslagen" (by me) or "Opgeslagen door Eva". */
export function savedLabel(m: SaveableMessage, me: string, nameOf: (id: string) => string | null | undefined): string | null {
  if (!m.saved) return null;
  if (!m.saved_by || m.saved_by === me) return 'Opgeslagen';
  const first = (nameOf(m.saved_by) ?? '').trim().split(/\s+/)[0];
  return `Opgeslagen door ${first || 'een vriend'}`;
}
/** Optimistic local update: returns a new list with the message (un)saved by `me`. Unknown ids leave the list as is. */
export function applySaved<T extends SaveableMessage>(rows: readonly T[], id: string, saved: boolean, me: string): T[] {
  return rows.map(r => (r.id === id ? { ...r, saved, saved_by: saved ? me : null } : r));
}
/** expires_at the server sets when a message is UNSAVED again (mirrors the migration): keep → never,
 *  otherwise 24 h from now (the client already hides viewed messages per the chat's setting). */
export function unsaveExpiry(mode: RetentionMode, now: number): string | null {
  return mode === 'keep' ? null : new Date(now + 86400000).toISOString();
}
/** Counter for the friendship profile / chat header: how many messages in this chat are saved. */
export function savedCount(rows: readonly SaveableMessage[]): number {
  return rows.filter(r => r.saved && canSave(r)).length;
}

/** Friendship profile "Opgeslagen in chat": the newest saved messages of the 1:1 chat as short previews. */
export type SavedPreview = { id: string; who: string; excerpt: string };
export function savedPreviews(
  rowsNewestFirst: readonly (SaveableMessage & { body: string | null })[], me: string, friendFirstName: string, max = 3,
  excerptOf: (m: SaveableMessage & { body: string | null }) => string = m => (m.body ?? '').trim(),
): SavedPreview[] {
  return rowsNewestFirst.filter(r => r.saved && canSave(r)).slice(0, max)
    .map(r => ({ id: r.id, who: r.sender_id === me ? 'Ik' : friendFirstName || 'Vriend', excerpt: excerptOf(r) || 'Bericht' }));
}
export function savedSectionTitle(n: number): string { return n === 1 ? '1 opgeslagen bericht' : `${n} opgeslagen berichten`; }
