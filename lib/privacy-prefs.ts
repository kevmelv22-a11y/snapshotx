/** Snapchat-style "Wie kan…" privacy controls (Instellingen › Privacy › Wie kan…).
 *  Stored per account in sx_preferences.privacy_prefs (jsonb, migration 20261029180000_privacy_prefs.sql)
 *  and mirrored on the device, so the screen keeps working before that migration is applied.
 *  - story: default audience for new stories (compose.tsx writes it to sx_stories.visibility; RLS already enforces it).
 *  - contact: chats and calls are friends-only on the server (sx_open_thread), so 'friends' is the only option for now.
 *  - quickAdd: mirrors sx_preferences.find_me (vriendensuggesties).
 *  - location: managed by Ghost mode on the Map. */

export type StoryAudience = 'everyone' | 'friends';
export type PrivacyPrefs = { story: StoryAudience };
export type WhoCanChoice<T extends string> = { value: T; label: string; description: string };

export const STORY_AUDIENCE_CHOICES: WhoCanChoice<StoryAudience>[] = [
  { value: 'everyone', label: 'Iedereen', description: 'Iedereen kan je verhaal zien, ook in Ontdekken en Video’s' },
  { value: 'friends', label: 'Mijn vrienden', description: 'Alleen vrienden die jij hebt toegevoegd' },
];

export const CONTACT_CHOICES: WhoCanChoice<'friends'>[] = [
  { value: 'friends', label: 'Mijn vrienden', description: 'Alleen vrienden kunnen je chatten, snaps sturen en bellen' },
];

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = Object.freeze({ story: 'friends' }) as PrivacyPrefs;
export const PRIVACY_STORAGE_KEY = (uid: string) => `sx.privacy.v1.${uid}`;

/** Anything (server jsonb, local JSON string, garbage) → complete prefs; unknown values fall back to the safe default. */
export function normalizePrivacyPrefs(raw: unknown): PrivacyPrefs {
  let v: unknown = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const src = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const story = STORY_AUDIENCE_CHOICES.some(c => c.value === src.story) ? src.story as StoryAudience : DEFAULT_PRIVACY_PREFS.story;
  return { story };
}

/** sx_stories.visibility for a new story. */
export function storyVisibility(prefs: PrivacyPrefs): StoryAudience {
  return normalizePrivacyPrefs(prefs).story;
}

export function choiceLabel<T extends string>(choices: WhoCanChoice<T>[], value: T): string {
  return choices.find(c => c.value === value)?.label ?? choices[0].label;
}

/** Rows of the "Wie kan…" overview, in Snapchat's order. */
export function whoCanRows(prefs: PrivacyPrefs, findMe: boolean, location: string | null) {
  return [
    { key: 'contact', label: 'Contact met mij opnemen', value: choiceLabel(CONTACT_CHOICES, 'friends') },
    { key: 'story', label: 'Mijn verhaal bekijken', value: choiceLabel(STORY_AUDIENCE_CHOICES, prefs.story) },
    { key: 'location', label: 'Mijn locatie zien', value: location ?? 'Instellen op de Map' },
    { key: 'quickAdd', label: 'Mij zien in Snel toevoegen', value: findMe ? 'Aan' : 'Uit' },
  ] as const;
}

/** Story tab / compose hint, e.g. "Verhaal · Mijn vrienden". */
export function storyAudienceHint(prefs: PrivacyPrefs): string {
  return `Verhaal · ${choiceLabel(STORY_AUDIENCE_CHOICES, storyVisibility(prefs))}`;
}
