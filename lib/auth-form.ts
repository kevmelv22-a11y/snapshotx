import { checkName } from './name-filter';

/** Pure helpers for the login/register screen (no React Native imports, so they run under `npx tsx --test`). */
export type LoginIdentifier = { kind: 'email'; email: string } | { kind: 'phone'; phone: string } | { kind: 'username'; username: string };

export const MIN_AGE = 13;
export const TEEN_MAX_AGE = 17;

/** Normalises a Dutch/international mobile number to E.164 (+31612345678), or null when it is not a phone number. */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim().replace(/[\s\-().]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(t)) return t;
  if (/^00[1-9]\d{7,14}$/.test(t)) return `+${t.slice(2)}`;
  if (/^06\d{8}$/.test(t)) return `+31${t.slice(1)}`;
  return null;
}

/** 'Gebruikersnaam, e-mail of telefoon' → which sign-in route to use. */
export function classifyIdentifier(raw: string): LoginIdentifier | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.indexOf('@') > 0) return { kind: 'email', email: t.toLowerCase() };
  const phone = normalizePhone(t);
  if (phone) return { kind: 'phone', phone };
  const u = t.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{3,30}$/.test(u) ? { kind: 'username', username: u } : null;
}

/** Parses 'DD-MM-JJJJ' (also / or .) or ISO 'JJJJ-MM-DD'; returns a valid past date or null. */
export function parseBirthdate(raw: string, now = new Date()): Date | null {
  const t = raw.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (r) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > now.getTime()) return null;
  return dt;
}

export function ageOn(birth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const md = (now.getUTCMonth() - birth.getUTCMonth()) || (now.getUTCDate() - birth.getUTCDate());
  if (md < 0) age--;
  return age;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export type RegisterInput = { username: string; email: string; password: string; birthdate: string; phone: string };
export type RegisterCheck = { ok: true; username: string; email: string; birthdate: string; age: number; teen: boolean; phone: string | null } | { ok: false; error: string };

export function validateRegister(i: RegisterInput, now = new Date()): RegisterCheck {
  const username = i.username.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return { ok: false, error: 'Gebruikersnaam: 3–24 tekens (letters, cijfers, . of _).' };
  const nameOk = checkName(username, 'username');
  if (!nameOk.ok) return { ok: false, error: nameOk.error };
  const email = i.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Vul een geldig e-mailadres in.' };
  if (i.password.length < 8) return { ok: false, error: 'Wachtwoord: minimaal 8 tekens.' };
  const birth = parseBirthdate(i.birthdate, now);
  if (!birth) return { ok: false, error: 'Vul je geboortedatum in als DD-MM-JJJJ.' };
  const age = ageOn(birth, now);
  if (age < MIN_AGE) return { ok: false, error: `Je moet minimaal ${MIN_AGE} jaar zijn om Snapshot X te gebruiken.` };
  let phone: string | null = null;
  if (i.phone.trim()) { phone = normalizePhone(i.phone); if (!phone) return { ok: false, error: 'Mobiel nummer: gebruik het formaat +31612345678.' }; }
  return { ok: true, username, email, birthdate: isoDate(birth), age, teen: age <= TEEN_MAX_AGE, phone };
}
