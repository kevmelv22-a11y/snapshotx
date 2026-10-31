import { localDay } from './birthday';

/**
 * 🎂 for friends (Snapchat "Verjaardagsfeest"): a friend who has the switch on gets 🎂 next to their name in the
 * friends list, the chat list and their Vriendschapsprofiel on their birthday. Pure helpers (no React Native).
 *
 * Friends only ever receive the month-day ("MM-DD"), never the year or age, from RPC sx_friend_birthdays
 * (supabase/migrations/20261031060000_friend_birthdays.sql, NOT applied). Without that RPC the app shows no 🎂.
 */
export const BIRTHDAY_RPC = 'sx_friend_birthdays';
export const CAKE = '🎂';

export type FriendBirthdayRow = { user_id?: unknown; birthday_md?: unknown; birthday_party?: unknown };

/** "11-14" → { month: 11, day: 14 }; anything else (incl. impossible dates like 02-30) → null. */
export function parseMonthDay(md: unknown): { month: number; day: number } | null {
  if (typeof md !== 'string') return null;
  const m = /^(\d{2})-(\d{2})$/.exec(md.trim());
  if (!m) return null;
  const month = Number(m[1]), day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const max = new Date(Date.UTC(2000, month, 0)).getUTCDate(); // 2000 = leap year, so 02-29 is allowed
  return day <= max ? { month, day } : null;
}

/** Is "MM-DD" today on this device's calendar? 29 Feb is celebrated on 28 Feb in non-leap years (like Snapchat). */
export function isMonthDayToday(md: unknown, now = new Date()): boolean {
  const p = parseMonthDay(md);
  if (!p) return false;
  const today = localDay(now), y = today.getUTCFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const day = p.month === 2 && p.day === 29 && !leap ? 28 : p.day;
  return today.getUTCMonth() + 1 === p.month && today.getUTCDate() === day;
}

/** Friend ids that get 🎂 today: Verjaardagsfeest on (missing = on, same default as the own switch) + birthday today. */
export function birthdayFriendIds(rows: readonly FriendBirthdayRow[] | null | undefined, now = new Date()): Set<string> {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    if (typeof r?.user_id !== 'string' || !r.user_id || r.birthday_party === false) continue;
    if (isMonthDayToday(r.birthday_md, now)) out.add(r.user_id);
  }
  return out;
}

/** "Aria is vandaag jarig! 🎂" for the Vriendschapsprofiel banner (first name only). */
export function birthdayBannerText(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] || 'Je vriend';
  return `${first} is vandaag jarig! ${CAKE}`;
}

/** Month-day of an ISO birthdate ("2004-11-14" → "11-14"); what the server RPC exposes to friends. */
export function monthDayOf(isoBirthdate: unknown): string | null {
  if (typeof isoBirthdate !== 'string') return null;
  const m = /^\d{4}-(\d{2}-\d{2})$/.exec(isoBirthdate.trim());
  return m && parseMonthDay(m[1]) ? m[1] : null;
}
