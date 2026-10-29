/** Snapchat "Afteltimers" (Countdowns) on Mijn profiel: count down to a birthday, holiday, concert …
 *  Device-local per account (stores/countdowns.ts) — no server table, no migration. Pure + unit-tested. */
import { checkName } from './name-filter';

export type Countdown = { id: string; title: string; emoji: string; at: number; createdAt: number };
export type Remaining = { done: boolean; days: number; hours: number; minutes: number; seconds: number; totalMs: number };

export const COUNTDOWN_MAX = 20;
export const TITLE_MAX = 40;
export const COUNTDOWN_EMOJIS = ['🎉', '🎂', '🎄', '✈️', '🏖️', '🎓', '⚽', '🎵', '❤️', '🎁', '🎃', '🎆', '🏆', '🎮', '🍕', '⭐'] as const;
/** Quick picks shown above the form (Snapchat suggests a few common events). */
export const COUNTDOWN_PRESETS: readonly { title: string; emoji: string }[] = [
  { title: 'Mijn verjaardag', emoji: '🎂' }, { title: 'Vakantie', emoji: '🏖️' }, { title: 'Concert', emoji: '🎵' },
  { title: 'Kerst', emoji: '🎄' }, { title: 'Oud & Nieuw', emoji: '🎆' }, { title: 'Wedstrijd', emoji: '⚽' },
];

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export function remaining(at: number, now: number): Remaining {
  const totalMs = Math.max(0, at - now);
  return { done: at <= now, days: Math.floor(totalMs / DAY), hours: Math.floor((totalMs % DAY) / HOUR), minutes: Math.floor((totalMs % HOUR) / MIN), seconds: Math.floor((totalMs % MIN) / 1000), totalMs };
}

/** Short Dutch label for list/profile: "Nog 12 dagen", "Nog 1 dag", "Nog 5 uur", "Nog 12 min", "Nu!", "Afgelopen". */
export function remainingLabel(at: number, now: number): string {
  const r = remaining(at, now);
  if (r.done) return now - at < HOUR ? 'Nu!' : 'Afgelopen';
  if (r.days >= 1) return `Nog ${r.days} ${r.days === 1 ? 'dag' : 'dagen'}`;
  if (r.hours >= 1) return `Nog ${r.hours} uur`;
  return `Nog ${Math.max(1, r.minutes)} min`;
}

/** Big tile digits: "12d 04u 09m" (or "04u 09m 12s" in the last day). */
export function remainingClock(at: number, now: number): string {
  const r = remaining(at, now), p = (n: number) => String(n).padStart(2, '0');
  if (r.done) return '00u 00m 00s';
  return r.days >= 1 ? `${r.days}d ${p(r.hours)}u ${p(r.minutes)}m` : `${p(r.hours)}u ${p(r.minutes)}m ${p(r.seconds)}s`;
}

/** Upcoming first (soonest first), then finished ones (most recently finished first). */
export function sortCountdowns(list: readonly Countdown[], now: number): Countdown[] {
  return [...list].sort((a, b) => {
    const ad = a.at <= now, bd = b.at <= now;
    if (ad !== bd) return ad ? 1 : -1;
    return ad ? b.at - a.at : a.at - b.at;
  });
}

/** Finished timers are removed automatically a week after they hit zero (Snapchat clears them too). */
export const pruneFinished = (list: readonly Countdown[], now: number) => list.filter(c => now - c.at < 7 * DAY);

/** Parse a Dutch date "dd-mm-jjjj" (also d/m/jjjj, d.m.jjjj) + optional time "uu:mm" to device-local ms, or null. */
export function parseDutchDateTime(date: string, time = ''): number | null {
  const d = date.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!d) return null;
  const t = time.trim() ? time.trim().match(/^(\d{1,2})[:.](\d{2})$/) : ['', '0', '0'];
  if (!t) return null;
  const [day, month, year, hour, minute] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const v = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (v.getFullYear() !== year || v.getMonth() !== month - 1 || v.getDate() !== day) return null; // 31-02 etc.
  return v.getTime();
}

/** Format device-local ms back to the form fields. */
export function formatDutchDate(ms: number): { date: string; time: string } {
  const v = new Date(ms), p = (n: number) => String(n).padStart(2, '0');
  return { date: `${p(v.getDate())}-${p(v.getMonth() + 1)}-${v.getFullYear()}`, time: `${p(v.getHours())}:${p(v.getMinutes())}` };
}

/** "za 24 dec 2026 · 20:00" (time omitted at midnight). */
export function whenLabel(ms: number): string {
  const v = new Date(ms), days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const base = `${days[v.getDay()]} ${v.getDate()} ${months[v.getMonth()]} ${v.getFullYear()}`;
  const { time } = formatDutchDate(ms);
  return time === '00:00' ? base : `${base} · ${time}`;
}

export type CountdownDraft = { title: string; emoji: string; date: string; time: string };
export type CountdownCheck = { ok: true; value: Omit<Countdown, 'id' | 'createdAt'> } | { ok: false; field: 'title' | 'date' | 'limit'; error: string };

/** Validate the "Nieuwe afteltimer" form: title 1–40 (name filter), valid future date, max 5 years ahead, max 20 timers. */
export function validateDraft(d: CountdownDraft, now: number, existing = 0): CountdownCheck {
  const title = d.title.replace(/\s+/g, ' ').trim();
  if (existing >= COUNTDOWN_MAX) return { ok: false, field: 'limit', error: `Je kunt maximaal ${COUNTDOWN_MAX} afteltimers hebben. Verwijder er eerst een.` };
  if (!title) return { ok: false, field: 'title', error: 'Geef je afteltimer een naam.' };
  if (title.length > TITLE_MAX) return { ok: false, field: 'title', error: `Maximaal ${TITLE_MAX} tekens.` };
  const name = checkName(title, 'display'); // only rude words block a timer title (it is shown on your profile)
  if (!name.ok && name.reason === 'offensive') return { ok: false, field: 'title', error: 'Deze naam is niet toegestaan: er staat een grof of kwetsend woord in.' };
  const at = parseDutchDateTime(d.date, d.time);
  if (at === null) return { ok: false, field: 'date', error: 'Vul een geldige datum in als dd-mm-jjjj (en tijd als uu:mm).' };
  if (at <= now) return { ok: false, field: 'date', error: 'Kies een moment in de toekomst.' };
  if (at - now > 5 * 366 * DAY) return { ok: false, field: 'date', error: 'Kies een datum binnen 5 jaar.' };
  return { ok: true, value: { title, emoji: d.emoji || '🎉', at } };
}

/** Next occurrence of a yearly day (e.g. a birthday) at 00:00 local; today counts if it is still ahead. */
export function nextYearly(day: number, month: number, now: number): number {
  const n = new Date(now);
  let v = new Date(n.getFullYear(), month - 1, day).getTime();
  if (v <= now) v = new Date(n.getFullYear() + 1, month - 1, day).getTime();
  return v;
}

/** Text for the Share sheet: "🎂 Mijn verjaardag — nog 12 dagen! (za 24 dec 2026)". */
export function shareText(c: Countdown, now: number): string {
  const l = remainingLabel(c.at, now);
  return `${c.emoji} ${c.title} — ${l === 'Nu!' || l === 'Afgelopen' ? l.toLowerCase() : l.replace(/^Nog/, 'nog')}! (${whenLabel(c.at)}) · via Snapshot X`;
}

/** Profile card rows: up to 3 upcoming timers, soonest first. */
export function profileTimers(list: readonly Countdown[], now: number): { id: string; emoji: string; title: string; label: string }[] {
  return sortCountdowns(list, now).filter(c => c.at > now).slice(0, 3).map(c => ({ id: c.id, emoji: c.emoji, title: c.title, label: remainingLabel(c.at, now) }));
}
