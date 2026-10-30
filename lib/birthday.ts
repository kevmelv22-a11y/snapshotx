import { MIN_AGE, TEEN_MAX_AGE, ageOn, isoDate, parseBirthdate } from './auth-form';

/**
 * Snapchat-style "Verjaardag" (Instellingen › Mijn account): show the birthdate from sign-up,
 * age, star sign, countdown, the "Verjaardagsfeest" switch (🎂 next to your name on your birthday)
 * and a limited birthdate change. Pure helpers, no React Native imports (runs under `npx tsx --test`).
 *
 * Stored in auth user_metadata: birthdate (ISO), is_teen, birthday_party (bool, default true),
 * birthdate_changes (number). The server must enforce the same limits before trusting them.
 */
export const MAX_BIRTHDATE_CHANGES = 2;

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** "3 november 2004" */
export function formatBirthdateNl(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "03-11-2004" for the edit field. */
export function toInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

export type Zodiac = { name: string; emoji: string };
// [start month (1-12), start day, name, emoji] in calendar order.
const SIGNS: [number, number, string, string][] = [
  [1, 20, 'Waterman', '♒'], [2, 19, 'Vissen', '♓'], [3, 21, 'Ram', '♈'], [4, 20, 'Stier', '♉'],
  [5, 21, 'Tweelingen', '♊'], [6, 21, 'Kreeft', '♋'], [7, 23, 'Leeuw', '♌'], [8, 23, 'Maagd', '♍'],
  [9, 23, 'Weegschaal', '♎'], [10, 23, 'Schorpioen', '♏'], [11, 22, 'Boogschutter', '♐'], [12, 22, 'Steenbok', '♑'],
];

/** Western star sign (Snapchat "Astrologisch profiel"). */
export function zodiacOf(d: Date): Zodiac {
  const m = d.getUTCMonth() + 1, day = d.getUTCDate();
  let sign = SIGNS[SIGNS.length - 1]; // Steenbok wraps 22 Dec – 19 Jan
  for (const s of SIGNS) if (m > s[0] || (m === s[0] && day >= s[1])) sign = s;
  return { name: sign[2], emoji: sign[3] };
}

/** Birthday date in a given year; 29 Feb falls on 28 Feb in non-leap years (like Snapchat). */
function birthdayIn(birth: Date, year: number): number {
  const m = birth.getUTCMonth(), d = birth.getUTCDate();
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return Date.UTC(year, m, m === 1 && d === 29 && !leap ? 28 : d);
}

/** The device's local calendar date as UTC midnight (birthdays follow the user's own day, not UTC). */
export const localDay = (now = new Date()) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

/** Whole days until the next birthday (0 = today), using the local calendar date of `now`. */
export function daysUntilBirthday(birth: Date, now = new Date()): number {
  const day = localDay(now), today = day.getTime(), year = day.getUTCFullYear();
  let next = birthdayIn(birth, year);
  if (next < today) next = birthdayIn(birth, year + 1);
  return Math.round((next - today) / 86_400_000);
}

export const isBirthdayToday = (birth: Date, now = new Date()) => daysUntilBirthday(birth, now) === 0;

/** Dutch countdown line. */
export function birthdayCountdownLabel(birth: Date, now = new Date()): string {
  const days = daysUntilBirthday(birth, now), turns = ageOn(birth, localDay(now)) + (days === 0 ? 0 : 1);
  if (days === 0) return `Gefeliciteerd! Je bent vandaag ${turns} geworden 🎂`;
  if (days === 1) return `Morgen word je ${turns} 🎉`;
  return `Nog ${days} dagen tot je ${turns}e verjaardag`;
}

/** 🎂 next to a name when that person has Verjaardagsfeest on and it's their birthday. */
export function birthdayBadge(birth: Date | null, partyOn: boolean, now = new Date()): string {
  return birth && partyOn && isBirthdayToday(birth, now) ? '🎂' : '';
}

export type BirthdayMeta = { birthdate?: unknown; is_teen?: unknown; birthday_party?: unknown; birthdate_changes?: unknown };
export type BirthdayState = { birth: Date | null; party: boolean; changesLeft: number; teen: boolean };

/** Reads the birthday fields from Supabase user_metadata, tolerating missing/odd values. */
export function readBirthdayMeta(meta: BirthdayMeta | null | undefined, now = new Date()): BirthdayState {
  const birth = typeof meta?.birthdate === 'string' ? parseBirthdate(meta.birthdate, now) : null;
  const used = Number(meta?.birthdate_changes);
  const changesLeft = Math.max(0, MAX_BIRTHDATE_CHANGES - (Number.isFinite(used) && used > 0 ? Math.floor(used) : 0));
  const teen = birth ? ageOn(birth, localDay(now)) <= TEEN_MAX_AGE : meta?.is_teen === true;
  return { birth, party: meta?.birthday_party !== false, changesLeft, teen };
}

export type BirthdateChange = { ok: true; patch: { birthdate: string; is_teen: boolean; birthdate_changes: number } } | { ok: false; error: string };

/**
 * Validates a birthdate change. Rules (Snapchat-like safety): max MAX_BIRTHDATE_CHANGES changes,
 * never under MIN_AGE, and a 13–17 account cannot make itself 18+ in the app (that goes via support).
 */
export function validateBirthdateChange(raw: string, state: BirthdayState, usedChanges: number, now = new Date()): BirthdateChange {
  if (state.changesLeft <= 0) return { ok: false, error: 'Je hebt je geboortedatum al het maximale aantal keer gewijzigd. Neem contact op met support.' };
  const birth = parseBirthdate(raw, now);
  if (!birth) return { ok: false, error: 'Vul je geboortedatum in als DD-MM-JJJJ.' };
  if (state.birth && isoDate(birth) === isoDate(state.birth)) return { ok: false, error: 'Dit is al je geboortedatum.' };
  const age = ageOn(birth, localDay(now));
  if (age < MIN_AGE) return { ok: false, error: `Je moet minimaal ${MIN_AGE} jaar zijn om Snapshot X te gebruiken.` };
  if (age > 120) return { ok: false, error: 'Vul je echte geboortedatum in.' };
  if (state.teen && age > TEEN_MAX_AGE) return { ok: false, error: 'Je kunt jezelf hier niet ouder dan 17 maken. Klopt je geboortedatum niet? Neem contact op met support.' };
  return { ok: true, patch: { birthdate: isoDate(birth), is_teen: age <= TEEN_MAX_AGE, birthdate_changes: Math.max(0, usedChanges) + 1 } };
}
