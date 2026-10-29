/**
 * Native-stack back buttons on iOS show the *previous* screen's title. The whole tab navigator is
 * a single root-stack screen named "(tabs)", so without a title every screen pushed from a tab
 * showed "(tabs)" as its back label. The root layout derives the (tabs) title from the focused
 * tab via this map, so the back label names the tab you came from.
 */
export const TAB_BACK_TITLES: Readonly<Record<string, string>> = {
  index: 'Camera',
  chats: 'Chat',
  map: 'Map',
  friends: 'Vrienden',
  videos: 'Video’s',
  stories: 'Verhalen',
  profile: 'Mijn profiel',
};

/** The tab navigator's initial route (expo-router uses `index` when no state exists yet). */
export const INITIAL_TAB = 'index';

/** Title for the "(tabs)" root screen given the focused tab route name (undefined before first render). */
export function tabsBackTitle(focusedTab: string | undefined): string {
  return TAB_BACK_TITLES[focusedTab ?? INITIAL_TAB] ?? 'Terug';
}

/**
 * Titles for root-stack screens that hide the native header. They are never shown as a header,
 * but iOS uses them as the back label of the next screen (e.g. Instellingen → Account verwijderen),
 * so they must never fall back to the route name.
 */
export const HIDDEN_HEADER_TITLES: Readonly<Record<string, string>> = {
  '(auth)': 'Inloggen',
  settings: 'Instellingen',
  'avatar-editor': 'Personage',
  'avatar/kast': 'Kast',
  'blocked-users': 'Geblokkeerd',
  'my-data': 'Mijn gegevens',
  notifications: 'Meldingen',
  'who-can': 'Wie kan…',
  countdowns: 'Afteltimers',
  'reset-password': 'Wachtwoord',
  'change-password': 'Wachtwoord',
  privacy: 'Privacybeleid',
  voorwaarden: 'Voorwaarden',
};
