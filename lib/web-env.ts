/**
 * Real (non-demo) web build for snapshot-x.nl — guard rails that run before `expo export` (scripts/export-web-real.mjs)
 * and the auth redirect the web build needs. Everything EXPO_PUBLIC_* ends up readable in the browser bundle, so a
 * secret / service_role key must never be in the env of a web build.
 */
export const REAL_WEB_ORIGINS = ['https://snapshot-x.nl', 'https://www.snapshot-x.nl', 'https://snapshot-x.expo.app'];
const NATIVE_CALLBACK = 'snapshotx://auth/callback';

/** Where Supabase e-mail links (confirm / password reset) must come back: the web origin's /auth/callback, or the app scheme. */
export function authRedirectUrl(platform: string, origin: string | undefined): string {
  if (platform !== 'web' || !origin || !/^https?:\/\/[^/\s]+$/i.test(origin)) return NATIVE_CALLBACK;
  return `${origin.replace(/\/+$/, '')}/auth/callback`;
}

function jwtRole(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try { const b = part.replace(/-/g, '+').replace(/_/g, '/'); return (JSON.parse(atob(b + '='.repeat((4 - b.length % 4) % 4))) as { role?: string }).role ?? null; } catch { return null; }
}

/** Dutch problems that block a real web export; [] = OK. Never echoes key values. */
export function realWebEnvProblems(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  if (env.EXPO_PUBLIC_DEMO_MODE) out.push('EXPO_PUBLIC_DEMO_MODE staat aan: dat is de demo, niet de echte webversie.');
  if (env.EXPO_PUBLIC_DEMO_BUTTON) out.push('EXPO_PUBLIC_DEMO_BUTTON hoort niet in een publieke build.');
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url) out.push('EXPO_PUBLIC_SUPABASE_URL ontbreekt.');
  else if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url)) out.push('EXPO_PUBLIC_SUPABASE_URL moet https://<project>.supabase.co zijn.');
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!key) out.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ontbreekt.');
  else if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') out.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is een geheime sleutel: die mag nooit in de browser.');
  else if (!key.startsWith('sb_publishable_') && jwtRole(key) !== 'anon') out.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is geen publishable/anon-sleutel.');
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('EXPO_PUBLIC_') || k === 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' || !v) continue;
    if (v.startsWith('sb_secret_') || jwtRole(v) === 'service_role' || /^sk_[A-Za-z0-9]/.test(v)) out.push(`${k} lijkt een geheime sleutel: verwijder hem uit de web-env.`);
  }
  return out;
}

/** Things that must not be in the exported real web bundle (checked after export). */
export function bundleLeaks(js: string): string[] {
  const out: string[] = [];
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(js)) out.push('geheime Supabase-sleutel in bundle');
  if (/sk_[A-Za-z0-9]{20,}/.test(js)) out.push('geheime (RevenueCat/Stripe) sleutel in bundle');
  if (/"role"\s*:\s*"service_role"/.test(js)) out.push('service_role in bundle');
  return out;
}
