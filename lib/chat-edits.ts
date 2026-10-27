/** Snapchat "Bewerken" + "Verwijderen" for chat messages.
 *  - Bewerken: hold your OWN text message → "Bewerken" (only within 5 minutes of sending). The input fills with the
 *    text, an "Bericht bewerken" bar shows above it, ➤ saves. Edited messages show a small "Bewerkt" label for everyone.
 *    A quoted reply keeps its quote: only the visible text is replaced.
 *  - Verwijderen: hold your OWN message → "Verwijderen" → confirm. It disappears for everyone and leaves Snapchat's
 *    grey line "<naam> heeft een chat verwijderd". Quotes of it then read "Verwijderd bericht".
 *  Server side: RPCs public.sx_edit_message / public.sx_unsend_message (migration 20261027090000_chat_edit_unsend.sql,
 *  NOT applied yet); the demo client mirrors them with the same rules + Dutch errors. No I/O. */
import { parseReply } from './chat-replies';
import { stickerFromChatBody } from './avatar/poses';
import { isPollText } from './chat-polls';

export const EDIT_WINDOW_MS = 5 * 60 * 1000;
export const EDIT_MAX_CHARS = 2000;
export const EDIT_LABEL = { edit: 'Bewerken', unsend: 'Verwijderen', edited: 'Bewerkt', bar: 'Bericht bewerken', quoteGone: 'Verwijderd bericht' } as const;
export const EDIT_ERRORS = {
  notFound: 'Dit bericht bestaat niet meer',
  notYours: 'Je kunt alleen je eigen berichten bewerken of verwijderen',
  notText: 'Alleen tekstberichten kun je bewerken',
  tooLate: 'Berichten kun je tot 5 minuten na het versturen bewerken',
  empty: 'Een bericht kan niet leeg zijn',
  tooLong: 'Dit bericht is te lang (max. 2000 tekens)',
  notUnsendable: 'Dit bericht kun je niet verwijderen',
} as const;
export const UNSEND_CONFIRM = { title: 'Bericht verwijderen?', body: 'Het bericht wordt voor iedereen in deze chat verwijderd.', ok: 'Verwijderen' } as const;

export type EditableMessage = { id: string; sender_id: string; kind: string; body: string | null; created_at: string; edited_at?: string | null; unsent_at?: string | null };

/** Own, not-yet-unsent text message sent less than 5 minutes ago (avatar stickers are text rows but not editable). */
export function canEdit(m: EditableMessage, me: string, now: number): boolean {
  if (m.sender_id !== me || m.kind !== 'text' || m.unsent_at) return false;
  const text = parseReply(m.body)?.text ?? m.body ?? '';
  if (isStickerText(text) || isPollText(text)) return false;
  const at = Date.parse(m.created_at);
  return Number.isFinite(at) && now - at >= -60000 && now - at < EDIT_WINDOW_MS;
}
export function isStickerText(text: string): boolean { return !!stickerFromChatBody(text) || /^\[avatar-sticker:/.test(text.trim()); }
/** Own messages of any kind except system lines can be unsent (Snapchat: also snaps you sent, even after opening). */
export function canUnsend(m: Pick<EditableMessage, 'sender_id' | 'kind' | 'unsent_at'>, me: string): boolean {
  return m.sender_id === me && m.kind !== 'system' && !m.unsent_at;
}
/** The text the edit field starts with (reply prefix removed). */
export function editableText(m: Pick<EditableMessage, 'body'>): string {
  return parseReply(m.body)?.text ?? m.body ?? '';
}
/** Validate a new text: returns the trimmed text or an error message. Same rules as the RPC. */
export function validateEdit(text: string): { ok: true; text: string } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: false, error: EDIT_ERRORS.empty };
  if ([...t].length > EDIT_MAX_CHARS) return { ok: false, error: EDIT_ERRORS.tooLong };
  return { ok: true, text: t };
}
/** New body to store: keeps an existing quoted-reply prefix, swaps only the visible text. */
export function editedBody(oldBody: string | null, newText: string): string {
  const t = newText.trim();
  const r = parseReply(oldBody);
  if (!r) return t;
  const prefix = (oldBody ?? '').slice(0, (oldBody ?? '').length - r.text.length);
  return prefix + t;
}
/** True when the edit would not change anything (then the client just closes edit mode). */
export function isNoopEdit(m: Pick<EditableMessage, 'body'>, newText: string): boolean {
  return editableText(m).trim() === newText.trim();
}
/** Snapchat's grey line left behind by an unsent message. */
export function unsentText(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return `${first || 'Iemand'} heeft een chat verwijderd`;
}
export function isUnsentLine(m: Pick<EditableMessage, 'kind' | 'unsent_at'>): boolean { return m.kind === 'system' && !!m.unsent_at; }
/** Small label under a bubble. */
export function editedLabel(m: Pick<EditableMessage, 'edited_at' | 'unsent_at'>): string | null {
  return m.edited_at && !m.unsent_at ? EDIT_LABEL.edited : null;
}
/** Optimistic local updates (immutable). */
export function applyEdit<T extends EditableMessage>(rows: readonly T[], id: string, newText: string, nowIso: string): T[] {
  return rows.map(r => (r.id === id ? { ...r, body: editedBody(r.body, newText), edited_at: nowIso } : r));
}
export function applyUnsend<T extends EditableMessage & { media_path?: string | null; saved?: boolean | null; saved_by?: string | null }>(rows: readonly T[], id: string, name: string | null | undefined, nowIso: string): T[] {
  return rows.map(r => (r.id === id ? { ...r, kind: 'system', body: unsentText(name), media_path: null, saved: false, saved_by: null, edited_at: null, unsent_at: nowIso } : r));
}
/** Quote excerpt to show for a reply: live text of the original when it is still loaded (so edits show up),
 *  "Verwijderd bericht" when it was unsent, otherwise the stored snapshot. */
export function liveQuoteExcerpt(stored: string, original: EditableMessage | undefined, quoteOf: (m: EditableMessage) => string): string {
  if (!original) return stored;
  if (original.unsent_at) return EDIT_LABEL.quoteGone;
  return original.edited_at ? quoteOf(original) : stored;
}
