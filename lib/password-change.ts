/** Pure logic for Instellingen › Mijn account › Wachtwoord (Snapchat "Password"): check the current password,
 *  pick a strong new one, optionally log out on other devices. No React Native imports (runs under tsx --test). */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt limit used by Supabase Auth

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; color: string };

const COMMON = new Set([
  'password', 'wachtwoord', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', 'abcdefgh', '11111111',
  '00000000', 'iloveyou', 'welkom01', 'welkom123', 'snapchat', 'snapshot', 'snapshotx', 'password1', 'wachtwoord1',
]);

/** Repeats (aaaa), straight runs (1234, abcd) and keyboard rows count as weak. */
function isTrivial(pw: string): boolean {
  const l = pw.toLowerCase();
  if (COMMON.has(l)) return true;
  if (/^(.)\1+$/.test(l)) return true;
  const runs = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  return runs.some(r => r.includes(l) || r.split('').reverse().join('').includes(l));
}

/** 0 = te kort/heel zwak … 4 = sterk. Length + variety, with known weak passwords capped at 1. */
export function passwordStrength(pw: string): PasswordStrength {
  const labels: Record<PasswordStrength['score'], [string, string]> = {
    0: ['Te kort', '#FF6B6B'], 1: ['Zwak', '#FF8A5B'], 2: ['Redelijk', '#FFC94D'], 3: ['Goed', '#7BDC7B'], 4: ['Sterk', '#38E0A5'],
  };
  const make = (score: PasswordStrength['score']) => ({ score, label: labels[score][0], color: labels[score][1] });
  if (pw.length < MIN_PASSWORD_LENGTH) return make(0);
  if (isTrivial(pw)) return make(1);
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  let score = 1;
  if (kinds >= 2) score++;
  if (kinds >= 3 || pw.length >= 12) score++;
  if (kinds >= 3 && pw.length >= 12) score++;
  return make(Math.min(4, score) as PasswordStrength['score']);
}

export type PasswordChangeInput = { current: string; next: string; repeat: string };
export type PasswordChangeCheck = { ok: true } | { ok: false; field: 'current' | 'next' | 'repeat'; error: string };

export function validatePasswordChange(i: PasswordChangeInput): PasswordChangeCheck {
  if (!i.current) return { ok: false, field: 'current', error: 'Vul je huidige wachtwoord in.' };
  if (i.next.length < MIN_PASSWORD_LENGTH) return { ok: false, field: 'next', error: `Gebruik minimaal ${MIN_PASSWORD_LENGTH} tekens.` };
  if (i.next.length > MAX_PASSWORD_LENGTH) return { ok: false, field: 'next', error: `Gebruik maximaal ${MAX_PASSWORD_LENGTH} tekens.` };
  if (/^\s|\s$/.test(i.next)) return { ok: false, field: 'next', error: 'Je wachtwoord mag niet beginnen of eindigen met een spatie.' };
  if (i.next === i.current) return { ok: false, field: 'next', error: 'Kies een ander wachtwoord dan je huidige.' };
  if (passwordStrength(i.next).score < 2) return { ok: false, field: 'next', error: 'Dit wachtwoord is te makkelijk te raden. Combineer letters, cijfers of tekens.' };
  if (i.next !== i.repeat) return { ok: false, field: 'repeat', error: 'De nieuwe wachtwoorden zijn niet gelijk.' };
  return { ok: true };
}

/** Which credentials re-check the current password: the account's email, else its phone number. */
export function reauthCredentials(user: { email?: string | null; phone?: string | null } | null | undefined, current: string):
  { email: string; password: string } | { phone: string; password: string } | null {
  if (user?.email) return { email: user.email, password: current };
  if (user?.phone) return { phone: user.phone.startsWith('+') ? user.phone : `+${user.phone}`, password: current };
  return null;
}

/** Supabase Auth errors → Dutch text for this screen. */
export function passwordChangeError(e: unknown, step: 'reauth' | 'update'): string {
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? '').toLowerCase();
  const code = String((e as { code?: unknown } | null)?.code ?? '').toLowerCase();
  if (step === 'reauth' && (code === 'invalid_credentials' || msg.includes('invalid login'))) return 'Je huidige wachtwoord klopt niet.';
  if (code === 'same_password' || msg.includes('different from the old')) return 'Kies een ander wachtwoord dan je huidige.';
  if (code === 'weak_password' || msg.includes('weak')) return 'Dit wachtwoord is te zwak. Kies een langer wachtwoord met letters en cijfers.';
  if (code === 'over_request_rate_limit' || msg.includes('rate limit') || msg.includes('too many')) return 'Te veel pogingen. Wacht even en probeer het opnieuw.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  return step === 'reauth' ? 'Je wachtwoord kon niet worden gecontroleerd. Probeer het opnieuw.' : 'Je wachtwoord kon niet worden gewijzigd. Probeer het opnieuw.';
}
