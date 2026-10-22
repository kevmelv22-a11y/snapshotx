/** Snapchat-style @mentions in group chats ("@vermeldingen"): typing "@" in the composer opens a member picker,
 *  picking a member inserts "@Voornaam " (full name when two members share a first name), the bubble shows the
 *  mention bold in that member's colour, and a member who is mentioned sees "@ Je bent vermeld" (chat list + bubble).
 *  Stored as plain readable text in `body` (no schema change; old app versions simply show "@Aria"). No I/O. */
export type MentionMember = { id: string; name: string | null | undefined };
export type MentionSegment = { text: string; userId?: string };

export const MENTION_BADGE = '@ Je bent vermeld';
export const MENTION_PICKER_TITLE = 'Vermeld iemand';
/** Max chars typed after "@" before the picker gives up (names in the picker are short; avoids matching prose). */
export const MENTION_QUERY_MAX = 24;
const WORD = /[\p{L}\p{N}_]/u;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('nl-NL');
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
export const firstName = (name: string | null | undefined) => clean(name).split(' ')[0] ?? '';

/** Text inserted after "@" for `m`: the first name, or the full name when another member has the same first name. */
export function mentionLabel(m: MentionMember, members: readonly MentionMember[]): string {
  const full = clean(m.name), first = firstName(full);
  if (!first) return 'Vriend';
  const clash = members.some(o => o.id !== m.id && fold(firstName(o.name)) === fold(first));
  return clash && full ? full : first;
}

/** Active "@query" at the caret: "@" at the start or after whitespace/opening punctuation, then letters without a space. */
export function mentionQuery(text: string, caret: number = text.length): { start: number; query: string } | null {
  const end = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, end);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/[\s([{"'“‘]/u.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > MENTION_QUERY_MAX || /[\s@]/u.test(query)) return null;
  if ([...query].some(ch => !WORD.test(ch) && ch !== '-' && ch !== '.')) return null;
  return { start: at, query };
}

/** Members that match the query (first name, any name part, or full name prefix; accent/case-insensitive).
 *  You never appear in your own picker. Prefix-of-first-name matches first, then alphabetical. */
export function mentionCandidates(members: readonly MentionMember[], me: string, query: string, limit = 6): MentionMember[] {
  const q = fold(query.trim());
  const unique = [...new Map(members.map(m => [m.id, m])).values()];
  const scored = unique.filter(m => m.id !== me && clean(m.name)).map(m => {
    const full = fold(clean(m.name)), parts = full.split(' ');
    const score = !q ? 1 : parts[0].startsWith(q) ? 0 : parts.some(p => p.startsWith(q)) || full.startsWith(q) ? 1 : -1;
    return { m, score, full };
  }).filter(x => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.full.localeCompare(b.full, 'nl'));
  return scored.slice(0, limit).map(x => x.m);
}

/** Replace the active "@query" (from `start` up to the caret) with "@Label " and return the new text + caret. */
export function insertMention(text: string, start: number, caret: number, label: string): { text: string; caret: number } {
  const end = Math.max(start, Math.min(caret, text.length));
  let rest = text.slice(end);
  // Swallow the rest of the word that was being typed (e.g. caret in the middle of "@Ar|ia").
  const tail = /^[\p{L}\p{N}_.-]*/u.exec(rest)?.[0] ?? '';
  rest = rest.slice(tail.length);
  if (!rest.startsWith(' ')) rest = ' ' + rest;
  const ins = `@${label}`;
  // Caret lands after the separating space, ready to keep typing.
  return { text: text.slice(0, start) + ins + rest, caret: start + ins.length + 1 };
}

/** Labels a member can be mentioned by, longest first (full name before first name; first name only when unique). */
function labels(members: readonly MentionMember[]): { label: string; id: string }[] {
  const out: { label: string; id: string }[] = [];
  for (const m of members) {
    const full = clean(m.name); if (!full) continue;
    out.push({ label: fold(full), id: m.id });
    const first = firstName(full);
    if (first !== full && !members.some(o => o.id !== m.id && fold(firstName(o.name)) === fold(first))) out.push({ label: fold(first), id: m.id });
  }
  return out.sort((a, b) => b.label.length - a.label.length);
}

/** Split a message body into plain text and mention segments (only real members are highlighted). */
export function parseMentions(body: string | null | undefined, members: readonly MentionMember[]): MentionSegment[] {
  const text = body ?? '';
  if (!text.includes('@') || !members.length) return text ? [{ text }] : [];
  const ls = labels(members), out: MentionSegment[] = [];
  let plain = '', i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '@' && (i === 0 || /[\s([{"'“‘]/u.test(text[i - 1]))) {
      const hit = ls.find(({ label }) => {
        const cand = text.slice(i + 1, i + 1 + label.length);
        if (fold(cand) !== label) return false;
        const next = text[i + 1 + label.length];
        return next === undefined || !WORD.test(next);
      });
      if (hit) {
        if (plain) { out.push({ text: plain }); plain = ''; }
        const len = 1 + hit.label.length;
        out.push({ text: text.slice(i, i + len), userId: hit.id });
        i += len; continue;
      }
    }
    plain += ch; i++;
  }
  if (plain) out.push({ text: plain });
  return out;
}

/** Ids mentioned in a body (unique, in order). */
export function mentionedIds(body: string | null | undefined, members: readonly MentionMember[]): string[] {
  return [...new Set(parseMentions(body, members).filter(s => s.userId).map(s => s.userId!))];
}
/** Does this body mention `userId`? */
export function mentionsUser(body: string | null | undefined, userId: string, members: readonly MentionMember[]): boolean {
  return !!userId && mentionedIds(body, members).includes(userId);
}
/** Chat list: an unread message from someone else in this thread mentions me → "@ Je bent vermeld". */
export function hasUnreadMention(
  messages: readonly { id: string; sender_id: string; kind: string; body: string | null }[],
  me: string, read: ReadonlySet<string>, members: readonly MentionMember[],
): boolean {
  return messages.some(m => m.sender_id !== me && m.kind === 'text' && !read.has(m.id) && mentionsUser(m.body, me, members));
}
