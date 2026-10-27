/** Snapchat "Peilingen" (polls) in group chats.
 *  - In a group chat tap 📊 → "Peiling maken": a question + 2–5 answers → ➤ sends it as a poll message.
 *  - Everyone in the group taps an answer to vote (one vote each; tap another answer to switch, tap your answer
 *    again to take your vote back). After voting you see the results: percentage bar, count and voters per answer.
 *  - A poll is a normal `text` message whose body is `[poll]{"q":"…","o":["…","…"]}` (old clients show the token as
 *    text; no change to sx_messages). Votes live in public.sx_poll_votes and only change through the RPC
 *    public.sx_vote_poll (migration 20261027150000_chat_polls.sql, NOT applied yet); the demo client mirrors it with
 *    the same rules + Dutch errors. Polls cannot be edited (Bewerken), only unsent. No I/O. */

export const POLL_PREFIX = '[poll]';
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 5;
export const POLL_QUESTION_MAX = 120;
export const POLL_OPTION_MAX = 40;
export const POLL_LABEL = { create: 'Peiling maken', send: 'Peiling versturen', add: 'Antwoord toevoegen', question: 'Stel een vraag…', option: (i: number) => `Antwoord ${i + 1}`, tapToVote: 'Tik om te stemmen', preview: '📊 Peiling', button: 'Peiling maken' } as const;
export const POLL_ERRORS = {
  noQuestion: 'Stel eerst een vraag',
  questionTooLong: `De vraag is te lang (max. ${POLL_QUESTION_MAX} tekens)`,
  fewOptions: `Een peiling heeft minstens ${POLL_MIN_OPTIONS} antwoorden nodig`,
  manyOptions: `Een peiling heeft maximaal ${POLL_MAX_OPTIONS} antwoorden`,
  optionTooLong: `Een antwoord is te lang (max. ${POLL_OPTION_MAX} tekens)`,
  duplicate: 'Twee antwoorden zijn hetzelfde',
  notPoll: 'Dit bericht is geen peiling',
  notMember: 'Je zit niet (meer) in deze chat',
  badOption: 'Dit antwoord bestaat niet',
} as const;

export type Poll = { question: string; options: string[] };
export type PollVote = { messageId: string; userId: string; option: number };
export type PollOptionResult = { index: number; label: string; count: number; pct: number; mine: boolean; voters: string[]; leading: boolean };
export type PollResult = { total: number; myVote: number | null; options: PollOptionResult[] };

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const len = (s: string) => [...s].length;

/** Validate the composer input (blank answer rows are ignored) and build the message body. */
export function pollBody(question: string, options: readonly string[]): { ok: true; body: string; poll: Poll } | { ok: false; error: string } {
  const q = clean(question);
  if (!q) return { ok: false, error: POLL_ERRORS.noQuestion };
  if (len(q) > POLL_QUESTION_MAX) return { ok: false, error: POLL_ERRORS.questionTooLong };
  const o = options.map(clean).filter(Boolean);
  if (o.length < POLL_MIN_OPTIONS) return { ok: false, error: POLL_ERRORS.fewOptions };
  if (o.length > POLL_MAX_OPTIONS) return { ok: false, error: POLL_ERRORS.manyOptions };
  if (o.some(x => len(x) > POLL_OPTION_MAX)) return { ok: false, error: POLL_ERRORS.optionTooLong };
  if (new Set(o.map(x => x.toLocaleLowerCase('nl-NL'))).size !== o.length) return { ok: false, error: POLL_ERRORS.duplicate };
  const poll = { question: q, options: o };
  return { ok: true, poll, body: POLL_PREFIX + JSON.stringify({ q, o }) };
}

/** The poll inside a message body, or null for anything that is not a well-formed poll. */
export function parsePoll(body: string | null | undefined): Poll | null {
  if (typeof body !== 'string') return null;
  const t = body.trim();
  if (!t.startsWith(POLL_PREFIX)) return null;
  try {
    const v = JSON.parse(t.slice(POLL_PREFIX.length)) as { q?: unknown; o?: unknown };
    const q = clean(v?.q), o = Array.isArray(v?.o) ? v.o.map(clean) : [];
    if (!q || o.length < POLL_MIN_OPTIONS || o.length > POLL_MAX_OPTIONS || o.some(x => !x)) return null;
    return { question: q, options: o };
  } catch { return null; }
}
/** Anything that looks like a poll token (also malformed ones) — never editable as text. */
export function isPollText(text: string | null | undefined): boolean { return typeof text === 'string' && text.trim().startsWith(POLL_PREFIX); }

/** Chat list / quote / notification text: "📊 Peiling: Hoe laat zaterdag?". */
export function pollPreview(p: Poll): string { return `${POLL_LABEL.preview}: ${p.question}`; }

/** Optimistic local vote: same answer again = take the vote back (null), otherwise set/switch (one vote per person). */
export function nextVote(votes: readonly PollVote[], messageId: string, userId: string, option: number): number | null {
  const cur = votes.find(v => v.messageId === messageId && v.userId === userId);
  return cur?.option === option ? null : option;
}
export function applyVote(votes: readonly PollVote[], messageId: string, userId: string, option: number | null): PollVote[] {
  const rest = votes.filter(v => !(v.messageId === messageId && v.userId === userId));
  return option === null ? rest : [...rest, { messageId, userId, option }];
}

/** Whole percentages that always add up to 100 (largest remainder), 0 for everything without votes. */
export function percentages(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map(c => (c * 100) / total), base = raw.map(Math.floor);
  let left = 100 - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - base[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; base[i]++; left--; }
  return base;
}

/** Results for one poll message. Votes for answers that no longer exist are ignored. */
export function tallyPoll(poll: Poll, votes: readonly PollVote[], messageId: string, me: string): PollResult {
  const mine = votes.filter(v => v.messageId === messageId && Number.isInteger(v.option) && v.option >= 0 && v.option < poll.options.length);
  const counts = poll.options.map((_, i) => mine.filter(v => v.option === i).length), pct = percentages(counts), top = Math.max(0, ...counts);
  const my = mine.find(v => v.userId === me)?.option ?? null;
  return {
    total: mine.length, myVote: my,
    options: poll.options.map((label, i) => ({ index: i, label, count: counts[i], pct: pct[i], mine: my === i, voters: mine.filter(v => v.option === i).map(v => v.userId), leading: top > 0 && counts[i] === top })),
  };
}
/** "Nog geen stemmen" / "1 stem" / "3 stemmen". */
export function votesLabel(total: number): string { return total === 0 ? 'Nog geen stemmen' : total === 1 ? '1 stem' : `${total} stemmen`; }
/** Results are shown once you voted (Snapchat), and always to the person who asked. */
export function showResults(r: PollResult, senderId: string, me: string): boolean { return r.myVote !== null || senderId === me; }

/** Server-side rule (same as sx_vote_poll): option must be null (take back) or an index of the poll. */
export function validateVote(poll: Poll | null, option: number | null): string | null {
  if (!poll) return POLL_ERRORS.notPoll;
  if (option === null) return null;
  return Number.isInteger(option) && option >= 0 && option < poll.options.length ? null : POLL_ERRORS.badOption;
}
