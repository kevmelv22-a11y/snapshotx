/**
 * Browser tab titles for the web version (Snapchat Web style): "(2) Chat • SnapShot X".
 * Expo Router disables its own document titles, so without this every tab just said "SnapShot X".
 * Pure + a tiny unread store (the tabs layout already counts unread chats) so node tests can load it.
 */
export const SITE_NAME = 'SnapShot X';

const ROUTE_TITLES: readonly (readonly [RegExp, string])[] = [
  [/^\/(index)?$/, 'Camera'],
  [/^\/chats?(\/|$)/, 'Chat'],
  [/^\/map(\/|$)/, 'Map'],
  [/^\/friends?(\/|$)/, 'Vrienden'],
  [/^\/videos(\/|$)/, 'Video’s'],
  [/^\/stories(\/|$)/, 'Verhalen'],
  [/^\/story\//, 'Verhaal'],
  [/^\/profile(\/|$)/, 'Mijn profiel'],
  [/^\/login(\/|$)/, 'Inloggen'],
  [/^\/register(\/|$)/, 'Registreren'],
  [/^\/auth\/callback/, 'Inloggen'],
  [/^\/add\//, 'Vriend toevoegen'],
  [/^\/call\//, 'Gesprek'],
  [/^\/settings(\/|$)/, 'Instellingen'],
  [/^\/help(\/|$)/, 'Help en support'],
  [/^\/privacy(\/|$)/, 'Privacybeleid'],
  [/^\/voorwaarden(\/|$)/, 'Gebruiksvoorwaarden'],
  [/^\/my-data(\/|$)/, 'Mijn gegevens'],
  [/^\/memories(\/|$)/, 'Herinneringen'],
  [/^\/discover(\/|$)/, 'Ontdekken'],
  [/^\/notifications(\/|$)/, 'Meldingen'],
  [/^\/reset-password(\/|$)/, 'Wachtwoord herstellen'],
  [/^\/change-password(\/|$)/, 'Wachtwoord'],
  [/^\/staff(\/|$)/, 'Staffpaneel'],
];

/** Section name for a pathname, or null (unknown routes just show the site name). */
export function routeTitle(pathname: string | null | undefined): string | null {
  const p = (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  for (const [re, t] of ROUTE_TITLES) if (re.test(p)) return t;
  return null;
}

export function pageTitle(pathname: string | null | undefined, unread = 0): string {
  const t = routeTitle(pathname), base = t ? `${t} • ${SITE_NAME}` : SITE_NAME;
  const n = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0;
  return n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base;
}

let unreadCount = 0;
const listeners = new Set<(n: number) => void>();
/** Set by the tabs layout (signed in); reset to 0 on sign-out. */
export function setTitleUnread(n: number) { if (n === unreadCount) return; unreadCount = n; listeners.forEach(l => l(n)); }
export function getTitleUnread() { return unreadCount; }
export function onTitleUnread(l: (n: number) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
