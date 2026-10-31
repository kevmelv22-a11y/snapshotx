/**
 * Name safety filter (App Store guideline 1.2 — user-generated content): blocks offensive words and
 * names that impersonate Snapshot X itself in usernames, display names and group names.
 * The server enforces the same lists via supabase/migrations/20261031030000_server_name_filter.sql
 * (trigger on profiles + sx_threads; keep both in sync — lib/name-filter-sql.test.mjs checks it).
 * Pure helpers (no React Native imports) so they run under `npx tsx --test`.
 *
 * Chat messages are deliberately NOT censored — like Snapchat, abuse in chats is handled via
 * Melden (report) + Blokkeren.
 */

export type NameKind = 'username' | 'display' | 'group';
export type NameCheck = { ok: true } | { ok: false; reason: 'offensive' | 'reserved'; error: string };

/** Unambiguous words: blocked anywhere inside the name (also when glued to other text, e.g. "xfuckx"). */
const BLOCK_ANYWHERE = [
  // English
  'fuck', 'motherf', 'nigger', 'nigga', 'faggot', 'whore', 'porn', 'hitler', 'pedophile', 'paedo',
  // Dutch
  'kanker', 'klootzak', 'teringl', 'tyfus', 'neuken', 'kutwijf', 'hoerenzoon', 'mongool',
];
/** Short/ambiguous words: only blocked as a whole word (so "Scunthorpe", "torpedo", "hoera", "pikachu" stay fine). */
const BLOCK_WORD = [
  'cunt', 'dick', 'cock', 'shit', 'bitch', 'slut', 'rape', 'rapist', 'retard', 'nazi', 'pedo', 'sex', 'kkk',
  'kut', 'lul', 'pik', 'slet', 'hoer', 'hoeren', 'kech', 'flikker', 'debiel', 'kkr', 'kanka', 'tering',
];
/** Brand / authority names nobody may take (impersonation). Blocked anywhere for the brand, as a word for the rest. */
const RESERVED_ANYWHERE = ['snapshotx', 'snapchat'];
const RESERVED_WORD = ['admin', 'administrator', 'support', 'staff', 'moderator', 'mod', 'official', 'officieel', 'helpdesk', 'security', 'beveiliging', 'root', 'system', 'systeem', 'team'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '€': 'e', '|': 'i' };

/** Lowercase, strip accents, undo l33t-speak. Keeps separators so we can still split into words. */
export function normalizeName(raw: string): string {
  return raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[0134578@$!€|]/g, c => LEET[c] ?? c);
}

const squeeze = (s: string) => s.replace(/(.)\1+/g, '$1'); // "fuuuuck" → "fuck"

function variants(raw: string): { compact: string[]; words: Set<string> } {
  const norm = normalizeName(raw);
  // Digits that are NOT leet (2, 6, 9) and every other non-letter split words.
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  // Also the raw-digit split, so "kut123" → "kut" even though 1 and 3 became letters above.
  const plain = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const all = new Set<string>();
  for (const w of [...words, ...plain]) { all.add(w); all.add(squeeze(w)); }
  const compact = norm.replace(/[^a-z]/g, '');
  // Glued-together initials like "k.u.t" or "f u c k" become one word too.
  if (words.length > 1 && words.every(w => w.length === 1)) { all.add(compact); all.add(squeeze(compact)); }
  return { compact: [compact, squeeze(compact)], words: all };
}

const hits = (v: { compact: string[]; words: Set<string> }, anywhere: string[], word: string[]) =>
  anywhere.some(b => v.compact.some(c => c.includes(b))) || word.some(b => v.words.has(b));

const WHAT: Record<NameKind, string> = { username: 'Deze gebruikersnaam', display: 'Deze naam', group: 'Deze groepsnaam' };

/** Returns why a name is not allowed, or ok. Empty names are ok here (length rules live elsewhere). */
export function checkName(raw: string, kind: NameKind = 'display'): NameCheck {
  const v = variants(raw);
  if (hits(v, BLOCK_ANYWHERE, BLOCK_WORD)) return { ok: false, reason: 'offensive', error: `${WHAT[kind]} is niet toegestaan: er staat een grof of kwetsend woord in.` };
  if (hits(v, RESERVED_ANYWHERE, RESERVED_WORD)) return { ok: false, reason: 'reserved', error: `${WHAT[kind]} lijkt op een officieel Snapshot X-account. Kies een andere naam.` };
  return { ok: true };
}

export const isNameAllowed = (raw: string, kind: NameKind = 'display') => checkName(raw, kind).ok;
