/**
 * Snapchat "Naam bewerken": your own name for a friend (sx_friend_nicknames, migration 20261101003000).
 * Only you see it: chat list, chat header + sender labels, friendship profile. Pure helpers (node tests).
 */
import { checkName } from './name-filter';

export const NICKNAME_MAX = 32;
export const NICKNAME_TEXT = {
  action: 'Naam bewerken',
  title: 'Naam bewerken',
  hint: 'Alleen jij ziet deze naam. Je vriend krijgt hier geen melding van.',
  save: 'Opslaan',
  remove: 'Naam verwijderen',
  empty: 'Vul een naam in, of kies Naam verwijderen.',
  tooLong: `Maximaal ${NICKNAME_MAX} tekens.`,
  notFriend: 'Je kunt alleen een naam geven aan iemand met wie je bevriend bent.',
  unavailable: 'Naam bewerken is nog niet beschikbaar op de server.',
} as const;

export type NicknameCheck = { ok: true; value: string | null } | { ok: false; error: string };

/** Trim + collapse spaces; '' means "remove the nickname"; same as the real name also removes it. */
export function validateNickname(raw: string, realName?: string | null): NicknameCheck {
  const v = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!v) return { ok: true, value: null };
  if ([...v].length > NICKNAME_MAX || v.length > NICKNAME_MAX * 2) return { ok: false, error: NICKNAME_TEXT.tooLong };
  if (realName && v === realName.trim()) return { ok: true, value: null };
  const c = checkName(v, 'display');
  if (!c.ok) return { ok: false, error: c.error };
  if (v.length > NICKNAME_MAX) return { ok: false, error: NICKNAME_TEXT.tooLong };
  return { ok: true, value: v };
}

export type NicknameMap = ReadonlyMap<string, string>;

/** The name to show for a person: my nickname for them, else their own display name. */
export function shownName(map: NicknameMap | undefined, id: string | null | undefined, fallback: string): string {
  return (id && map?.get(id)) || fallback;
}

/** Chat list rows: 1:1 chats without a group title show my nickname for the friend. */
export function withNicknames<T extends { title: string; isGroup: boolean; peerIds: string[]; demo?: boolean }>(rows: readonly T[], map: NicknameMap | undefined): T[] {
  if (!map?.size) return rows as T[];
  return rows.map(r => !r.isGroup && !r.demo && r.peerIds.length === 1 && map.get(r.peerIds[0]) ? { ...r, title: map.get(r.peerIds[0])! } : r);
}

/** Server error → Dutch text (RLS = not friends; 22023 name_not_allowed = word filter; check = length). */
export function nicknameError(e: { code?: string; message?: string } | null | undefined): string | null {
  if (!e) return null;
  const m = String(e.message ?? '');
  if (e.code === '42501' || /row-level security/i.test(m)) return NICKNAME_TEXT.notFriend;
  if (/name_not_allowed/.test(m)) return 'Deze naam is niet toegestaan: er staat een grof of kwetsend woord in.';
  if (/sx_friend_nicknames_(len|chars)/.test(m) || e.code === '23514') return NICKNAME_TEXT.tooLong;
  if (e.code === '42P01' || e.code === 'PGRST205') return NICKNAME_TEXT.unavailable;
  return null;
}
