/** Snapchat "Doorsturen" (forward) for chat messages.
 *  - Hold a chat message → "Doorsturen" → the "Doorsturen naar…" sheet: search, pick up to 10 chats (groups, recent
 *    1-op-1 chats and friends you have not chatted with yet) → ➤ Verzenden. A copy lands in each chosen chat as YOUR
 *    message with a small "↪ Doorgestuurd" label (Snapchat shows forwarded chats like this, without the original sender).
 *  - Text, photos, videos, voice notes and avatar stickers can be forwarded. One-time snaps, system lines, deleted
 *    messages and polls cannot (Snapchat: received snaps are never forwardable; votes belong to one chat).
 *  - A quoted reply is forwarded without its quote (the quote points into the other chat).
 *  Server side: RPC public.sx_forward_message(p_message_id, p_thread_ids) (migration 20261027180000_chat_forward.sql,
 *  NOT applied yet). It is needed because the insert policy only allows media from your own storage folder; the RPC
 *  copies the row (incl. a friend's photo) after checking membership, blocks, expiry and kind. The demo client mirrors
 *  it with the same rules + Dutch errors. No I/O. */
import { parseReply } from './chat-replies';
import { unopenedChatDeadline } from './chat-features';
import { isPollText } from './chat-polls';

export const FORWARD_MAX_TARGETS = 10;
export const FORWARD_LABEL = {
  action: 'Doorsturen', title: 'Doorsturen naar…', search: 'Zoeken', send: 'Verzenden', forwarded: 'Doorgestuurd',
  groups: 'Groepen', recent: 'Recent', friends: 'Vrienden', none: 'Geen chats gevonden',
} as const;
export const FORWARD_ERRORS = {
  notFound: 'Dit bericht bestaat niet meer',
  notMember: 'Je zit niet (meer) in deze chat',
  notForwardable: 'Snaps, peilingen en meldingen kun je niet doorsturen',
  noTargets: 'Kies minstens één chat',
  tooMany: `Je kunt naar maximaal ${FORWARD_MAX_TARGETS} chats tegelijk doorsturen`,
  blocked: 'Naar deze chat kun je niet doorsturen',
} as const;

export type ForwardableMessage = { kind: string; body: string | null; view_once?: boolean | null; unsent_at?: string | null; media_path?: string | null; expires_at?: string | null };

/** Text (incl. avatar stickers), photo, video and voice; not snaps, system lines, unsent rows, polls or expired rows. */
export function canForward(m: ForwardableMessage, now = Date.now()): boolean {
  if (m.unsent_at || m.view_once) return false;
  if (m.expires_at && Date.parse(m.expires_at) <= now) return false;
  if (m.kind === 'text') { const t = forwardBody(m); return !!t && !isPollText(t); }
  if (m.kind === 'photo' || m.kind === 'video' || m.kind === 'voice') return !!m.media_path;
  return false;
}
/** Body of the copy: the visible text without a quoted-reply prefix (media rows keep their body as is). */
export function forwardBody(m: Pick<ForwardableMessage, 'kind' | 'body'>): string | null {
  if (m.kind !== 'text') return m.body ?? null;
  const t = (parseReply(m.body)?.text ?? m.body ?? '').trim();
  return t || null;
}
/** "↪ Doorgestuurd" label on a bubble. */
export function forwardedLabel(m: { forwarded_at?: string | null }): string | null {
  return m.forwarded_at ? FORWARD_LABEL.forwarded : null;
}

/** A row in the "Doorsturen naar…" sheet. key = 'thread:<id>' (existing chat) or 'friend:<id>' (no 1-op-1 chat yet). */
export type ForwardTarget = { key: string; kind: 'group' | 'chat' | 'friend'; title: string; peerIds: string[]; threadId: string | null; friendId: string | null };
export type ChatLike = { id: string; title: string; isGroup: boolean; peerIds: string[]; createdAt?: string | null; demo?: boolean };

/** Build the target list: recent chats first (groups + 1-op-1), then friends without a 1-op-1 chat, A–Z.
 *  The chat you are forwarding FROM is left out; preview/demo rows never appear. */
export function forwardTargets(chats: readonly ChatLike[], friends: readonly { id: string; display_name: string | null }[], currentThreadId: string): ForwardTarget[] {
  const real = chats.filter(c => !c.demo && c.id !== currentThreadId);
  const sorted = [...real].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const direct = new Set(chats.filter(c => !c.isGroup && c.peerIds.length === 1).map(c => c.peerIds[0]));
  const out: ForwardTarget[] = sorted.map(c => ({ key: `thread:${c.id}`, kind: c.isGroup ? 'group' : 'chat', title: c.title, peerIds: c.peerIds, threadId: c.id, friendId: null }));
  const rest = friends.filter(f => f.id && !direct.has(f.id))
    .map(f => ({ key: `friend:${f.id}`, kind: 'friend' as const, title: (f.display_name ?? '').trim() || 'Vriend', peerIds: [f.id], threadId: null, friendId: f.id }))
    .sort((a, b) => a.title.localeCompare(b.title, 'nl'));
  return [...out, ...rest];
}
/** Case/accent-insensitive search on the title. Fewer than 1 character → everything. */
export function filterTargets(targets: readonly ForwardTarget[], query: string): ForwardTarget[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl');
  const q = norm(query.trim());
  return q ? targets.filter(t => norm(t.title).includes(q)) : [...targets];
}
/** Tap a row: select / deselect. Selecting beyond the max returns an error and leaves the selection unchanged. */
export function toggleTarget(selected: readonly string[], key: string, max = FORWARD_MAX_TARGETS): { selected: string[]; error: string | null } {
  if (selected.includes(key)) return { selected: selected.filter(k => k !== key), error: null };
  if (selected.length >= max) return { selected: [...selected], error: FORWARD_ERRORS.tooMany };
  return { selected: [...selected, key], error: null };
}
/** Bottom bar text: "Aria, Weekend crew" (first names / group titles, max 3 then "+2"). */
export function selectionSummary(targets: readonly ForwardTarget[], selected: readonly string[]): string {
  const names = selected.map(k => targets.find(t => t.key === k)).filter((t): t is ForwardTarget => !!t)
    .map(t => (t.kind === 'group' ? t.title : t.title.split(/\s+/)[0]));
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}
/** Toast after sending: "Doorgestuurd naar Aria" / "Doorgestuurd naar 3 chats". */
export function forwardDoneText(names: readonly string[]): string {
  if (names.length === 1) return `Doorgestuurd naar ${names[0]}`;
  return `Doorgestuurd naar ${names.length} chats`;
}
/** Validate a selection before calling the RPC. */
export function validateSelection(selected: readonly string[]): string | null {
  if (!selected.length) return FORWARD_ERRORS.noTargets;
  if (selected.length > FORWARD_MAX_TARGETS) return FORWARD_ERRORS.tooMany;
  return null;
}
/** expires_at the copy gets in a target chat (mirrors the sx_stamp_retention trigger of 20261028060000_unopened_chats_31d.sql):
 *  'keep' → never, otherwise the unopened cap of 31 days; opening it later shortens this to 24 h after everyone viewed it.
 *  (Was 24 h from now, so a forwarded chat vanished after a day even if nobody had opened it.) */
export function forwardExpiry(retentionMode: string | null | undefined, now: number): string | null {
  return retentionMode === 'keep' ? null : new Date(unopenedChatDeadline(now)).toISOString();
}
