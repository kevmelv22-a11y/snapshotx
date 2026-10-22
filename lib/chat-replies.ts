/** Snapchat-style quoted replies in chat ("Antwoorden"): swipe right or long-press → reply bar above the input →
 *  the sent message shows a small quote of the original (coloured sender name + excerpt); tap the quote to jump.
 *  Stored inside the existing `body` text column (like avatar stickers), so it needs NO schema change:
 *    [reply:<id>|<sender id>|<kind>|<url-encoded excerpt>]\n<reply text>
 *  The excerpt is a snapshot, so the quote stays readable after the original disappeared (retention). No I/O. */
import { stickerFromChatBody } from './avatar/poses';

export type QuoteKind = 'text' | 'photo' | 'video' | 'voice' | 'snap' | 'sticker';
export type ReplyRef = { id: string; senderId: string; kind: QuoteKind; excerpt: string };
export type QuotableMessage = { id: string; sender_id: string; kind: string; body: string | null };

export const EXCERPT_MAX = 80;
const ID = '[0-9A-Za-z-]{1,64}';
const REPLY_RE = new RegExp(`^\\[reply:(${ID})\\|(${ID})\\|(text|photo|video|voice|snap|sticker)\\|([^\\]\\n]{0,400})\\]\\n([\\s\\S]*)$`);
const KIND_LABEL: Record<Exclude<QuoteKind, 'text'>, string> = { photo: '📷 Foto', video: '🎥 Video', voice: '🎙 Spraakbericht', snap: '■ Snap', sticker: '☺ Avatarsticker' };

/** Parse a stored body. Returns null for normal messages (or anything malformed: then the raw body is shown). */
export function parseReply(body: string | null | undefined): { ref: ReplyRef; text: string } | null {
  if (typeof body !== 'string') return null;
  const m = REPLY_RE.exec(body);
  if (!m) return null;
  let excerpt: string;
  try { excerpt = decodeURIComponent(m[4]); } catch { return null; }
  return { ref: { id: m[1], senderId: m[2], kind: m[3] as QuoteKind, excerpt }, text: m[5] };
}
/** The visible text of a body (reply prefix removed). */
export function replyText(body: string | null | undefined): string | null {
  const r = parseReply(body);
  return r ? r.text : body ?? null;
}
function clip(s: string, max = EXCERPT_MAX): string {
  const one = s.replace(/\s+/g, ' ').trim();
  const chars = [...one];
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : one;
}
/** What a quote of message `m` shows: its text (without its own quote), or a label for media / snaps / stickers. */
export function quoteOf(m: QuotableMessage): { kind: QuoteKind; excerpt: string } {
  if (m.kind === 'snap') return { kind: 'snap', excerpt: KIND_LABEL.snap };
  if (m.kind === 'photo' || m.kind === 'video' || m.kind === 'voice') return { kind: m.kind, excerpt: KIND_LABEL[m.kind] };
  const text = replyText(m.body) ?? '';
  const st = stickerFromChatBody(text);
  if (st) return { kind: 'sticker', excerpt: `${KIND_LABEL.sticker}: ${st.caption}` };
  return { kind: 'text', excerpt: clip(text) || 'Bericht' };
}
/** System lines (screenshots, retention, group changes) cannot be answered. */
export function canReply(m: { kind: string }): boolean { return m.kind !== 'system'; }
/** Body to store for `text` as a reply to `target`. Empty text → null (nothing to send). */
export function replyBody(target: QuotableMessage, text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (!canReply(target)) return t;
  const q = quoteOf(target);
  return `[reply:${target.id}|${target.sender_id}|${q.kind}|${encodeURIComponent(q.excerpt)}]\n${t}`;
}
/** Reply bar above the input: "Antwoord op Aria" / "Antwoord op jezelf". */
export function replyBarTitle(senderId: string, me: string, name: string | null | undefined): string {
  if (senderId === me) return 'Antwoord op jezelf';
  return `Antwoord op ${(name ?? '').trim().split(/\s+/)[0] || 'vriend'}`;
}
/** Swipe-to-reply: a mostly horizontal drag to the right of at least `threshold` px. */
export const SWIPE_REPLY_PX = 56;
export function isReplySwipe(dx: number, dy: number, threshold = SWIPE_REPLY_PX): boolean {
  return dx >= threshold && Math.abs(dy) < dx / 2;
}
/** Start tracking a row drag only for clear horizontal right-drags (vertical scrolling keeps working). */
export function startsReplySwipe(dx: number, dy: number): boolean {
  return dx > 10 && Math.abs(dx) > Math.abs(dy) * 2;
}
/** Index of the quoted original in the (newest-first) list, or -1 when it is gone (expired / older than loaded). */
export function quotedIndex(rows: readonly { id: string }[], ref: ReplyRef): number {
  return rows.findIndex(r => r.id === ref.id);
}
export const QUOTE_GONE = 'Het originele bericht is niet meer in deze chat';
/** One-line readable form for places that show raw bodies (staff console, reports): ↩ „excerpt" → text. */
export function readableBody(body: string | null | undefined): string | null {
  const r = parseReply(body);
  return r ? `↩ Antwoord op „${r.ref.excerpt}": ${r.text}` : body ?? null;
}
