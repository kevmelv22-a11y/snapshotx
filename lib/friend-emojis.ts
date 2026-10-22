/** Snapchat "Vriend-emoji's": the little emoji next to a friend's name in the chat list and on the Vriendschapsprofiel
 *  (💕 Super BFF, ❤️ BFF's, 💛 BFF, 😊 Beste vrienden, 👶 Nieuwe vriend, plus the 🔥/⌛ streak glyphs).
 *  Computed on the device from 1-on-1 interactions you can already see (snaps count double, both sides must have
 *  sent something). Emoji choices are customisable per account (stores/friendEmojis.ts). Pure + unit-tested. */

export type RelationKind = 'super_bff' | 'bffs' | 'bff' | 'best_friend' | 'new_friend';
export type FriendEmojiKind = RelationKind | 'streak' | 'hourglass';
export type FriendEmojiChoices = Partial<Record<FriendEmojiKind, string>>;

export const DEFAULT_FRIEND_EMOJIS: Record<FriendEmojiKind, string> = {
  super_bff: '💕', bffs: '❤️', bff: '💛', best_friend: '😊', new_friend: '👶', streak: '🔥', hourglass: '⌛',
};
/** Settings order + Dutch copy (Snapchat: Instellingen → Vriend-emoji's). */
export const FRIEND_EMOJI_INFO: readonly { kind: FriendEmojiKind; title: string; description: string }[] = [
  { kind: 'super_bff', title: 'Super BFF', description: 'Al 2 maanden op rij je #1 beste vriend.' },
  { kind: 'bffs', title: "BFF's", description: 'Al 2 weken op rij je #1 beste vriend.' },
  { kind: 'bff', title: 'BFF', description: 'Je #1 beste vriend: met niemand snap of chat je meer.' },
  { kind: 'best_friend', title: 'Beste vrienden', description: 'Een van je beste vrienden: je snapt en chat veel met elkaar.' },
  { kind: 'new_friend', title: 'Nieuwe vriend', description: 'Jullie zijn net vrienden geworden (minder dan een week).' },
  { kind: 'streak', title: 'Snapstreak', description: 'Jullie sturen elkaar al dagen op rij een snap.' },
  { kind: 'hourglass', title: 'Snapstreak bijna voorbij', description: 'Stuur snel een snap, anders verlies je je Snapstreak.' },
];
/** Emoji grid in the picker (Snapchat offers a fixed set). */
export const EMOJI_CHOICES = ['💕', '❤️', '💛', '😊', '👶', '🔥', '⌛', '😎', '🥰', '😍', '🤩', '😂', '😜', '🤪', '🤗', '💖', '💜', '💙', '💚', '🧡', '🖤', '🤍', '⭐', '🌟', '✨', '💯', '👑', '💎', '🦄', '🐣', '🌸', '🍀', '⚡', '🚀', '🎉', '😇'] as const;

export const BEST_FRIENDS_MAX = 8;
export const MIN_SCORE = 4;
export const NEW_FRIEND_MS = 7 * 86400000;
const WEEK = 7 * 86400000;

export type Interaction = { peerId: string; senderId: string; kind: string; at: number };

/** Interaction score per friend in [from, to): text = 1, snap = 2 (system lines ignored). A friend only scores when
 *  BOTH of you sent something in the window — Snapchat best friends are mutual interaction, not one-way spam. */
export function scores(events: readonly Interaction[], me: string, from: number, to: number): Map<string, number> {
  const sum = new Map<string, number>(), mine = new Set<string>(), theirs = new Set<string>();
  for (const e of events) {
    if (e.at < from || e.at >= to || e.kind === 'system' || !e.peerId || e.peerId === me) continue;
    if (e.senderId !== me && e.senderId !== e.peerId) continue;
    sum.set(e.peerId, (sum.get(e.peerId) ?? 0) + (e.kind === 'snap' ? 2 : 1));
    (e.senderId === me ? mine : theirs).add(e.peerId);
  }
  for (const id of [...sum.keys()]) if (!mine.has(id) || !theirs.has(id)) sum.delete(id);
  return sum;
}
/** Best friends in a window, best first (ties: newest interaction first, then id): score ≥ MIN_SCORE, max 8. */
export function bestFriends(events: readonly Interaction[], me: string, from: number, to: number): string[] {
  const sc = scores(events, me, from, to), last = new Map<string, number>();
  for (const e of events) if (e.at >= from && e.at < to && sc.has(e.peerId)) last.set(e.peerId, Math.max(last.get(e.peerId) ?? 0, e.at));
  return [...sc].filter(([, v]) => v >= MIN_SCORE)
    .sort((a, b) => b[1] - a[1] || (last.get(b[0]) ?? 0) - (last.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
    .slice(0, BEST_FRIENDS_MAX).map(([id]) => id);
}
/** #1 best friend per week, newest week first: weeks[0] = the last 7 days, weeks[1] = the 7 days before, … */
export function numberOnes(events: readonly Interaction[], me: string, now: number, weeks: number): (string | null)[] {
  return Array.from({ length: weeks }, (_, i) => bestFriends(events, me, now - (i + 1) * WEEK, now - i * WEEK + (i === 0 ? 1 : 0))[0] ?? null);
}

/** Relationship emoji kind per friend. Priority: 💕 (#1 for 8 weeks) > ❤️ (#1 for 2 weeks) > 💛 (#1 now) >
 *  😊 (top 8 now) > 👶 (friends < 7 days). `friendsSince` = friendship created_at (ms) per friend id. */
export function relationKinds(events: readonly Interaction[], me: string, now: number, friendsSince: ReadonlyMap<string, number> = new Map()): Map<string, RelationKind> {
  const out = new Map<string, RelationKind>();
  const ones = numberOnes(events, me, now, 8), top = ones[0];
  if (top) out.set(top, ones.every(x => x === top) ? 'super_bff' : ones[1] === top ? 'bffs' : 'bff');
  for (const id of bestFriends(events, me, now - WEEK, now + 1)) if (!out.has(id)) out.set(id, 'best_friend');
  for (const [id, since] of friendsSince) if (!out.has(id) && id !== me && Number.isFinite(since) && now - since >= 0 && now - since < NEW_FRIEND_MS) out.set(id, 'new_friend');
  return out;
}

/** The chosen emoji for a kind (custom choice when set, else the Snapchat default). */
export function emojiFor(kind: FriendEmojiKind, choices?: FriendEmojiChoices | null): string {
  const c = choices?.[kind];
  return typeof c === 'string' && c.trim() ? c : DEFAULT_FRIEND_EMOJIS[kind];
}
/** Store a choice; picking the default (or empty) removes the override. Returns a new object. */
export function setChoice(choices: FriendEmojiChoices | null | undefined, kind: FriendEmojiKind, emoji: string | null): FriendEmojiChoices {
  const next: FriendEmojiChoices = { ...(choices ?? {}) };
  if (!emoji || !emoji.trim() || emoji === DEFAULT_FRIEND_EMOJIS[kind]) delete next[kind]; else next[kind] = emoji;
  return next;
}
export function infoFor(kind: FriendEmojiKind) { return FRIEND_EMOJI_INFO.find(x => x.kind === kind)!; }
/** Accessibility / profile chip: "❤️ BFF's". */
export function relationLabel(kind: RelationKind, choices?: FriendEmojiChoices | null): string { return `${emojiFor(kind, choices)} ${infoFor(kind).title}`; }
