/** Snapchat-style "Meldingen" settings: one master switch plus a switch per kind of notification.
 *  Stored per account in sx_preferences.notify_prefs (jsonb, migration 20261029120000_notification_prefs.sql)
 *  and mirrored on the device, so the screen keeps working before that migration is applied.
 *  The push-message function + sx_push_recipients honour `enabled`, `chats` and `sound`; the other kinds are
 *  stored now so they are respected as soon as those notifications are sent. */

export type NotifyKey = 'chats' | 'calls' | 'mentions' | 'friendRequests' | 'stories' | 'streaks' | 'birthdays' | 'memories' | 'sound';
export type NotifyPrefs = { enabled: boolean } & Record<NotifyKey, boolean>;
export type NotifyOption = { key: NotifyKey; label: string; description: string };
export type NotifySection = { title: string; options: NotifyOption[] };

export const NOTIFY_SECTIONS: NotifySection[] = [
  { title: 'Van vrienden', options: [
    { key: 'chats', label: 'Chats en snaps', description: 'Als iemand je een chat, snap of spraakbericht stuurt' },
    { key: 'calls', label: 'Gesprekken', description: 'Inkomende spraak- en videogesprekken' },
    { key: 'mentions', label: 'Vermeldingen', description: 'Als iemand je @vermeldt in een groep' },
    { key: 'friendRequests', label: 'Vriendschapsverzoeken', description: 'Nieuwe verzoeken en geaccepteerde verzoeken' },
    { key: 'stories', label: 'Verhalen van vrienden', description: 'Als een vriend een nieuw verhaal plaatst' },
  ] },
  { title: 'Herinneringen', options: [
    { key: 'streaks', label: 'Snapstreaks', description: 'Als een Snapstreak bijna afloopt ⌛' },
    { key: 'birthdays', label: 'Verjaardagen', description: 'Als een vriend jarig is 🎂' },
    { key: 'memories', label: 'Flashbacks', description: 'Herinneringen van deze dag in eerdere jaren' },
  ] },
  { title: 'Geluid en toestel', options: [
    { key: 'sound', label: 'Geluid', description: 'Speel een geluid af bij een melding' },
  ] },
];

export const NOTIFY_KEYS: NotifyKey[] = NOTIFY_SECTIONS.flatMap(s => s.options.map(o => o.key));
export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = Object.freeze({
  enabled: true, ...Object.fromEntries(NOTIFY_KEYS.map(k => [k, true])),
}) as NotifyPrefs;

export const NOTIFY_STORAGE_KEY = (uid: string) => `sx.notify.v1.${uid}`;

/** Anything (server jsonb, local JSON string, garbage) → complete prefs; unknown keys dropped, missing ones on. */
export function normalizeNotifyPrefs(raw: unknown): NotifyPrefs {
  let v: unknown = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const src = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const out = { ...DEFAULT_NOTIFY_PREFS };
  for (const k of ['enabled', ...NOTIFY_KEYS] as (keyof NotifyPrefs)[]) if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  return out;
}

export function setNotifyPref(prefs: NotifyPrefs, key: keyof NotifyPrefs, value: boolean): NotifyPrefs {
  return { ...prefs, [key]: value };
}

/** Is a notification of this kind shown? The master switch wins; 'sound' is not a kind of notification. */
export function shouldNotify(prefs: NotifyPrefs, kind: Exclude<NotifyKey, 'sound'>): boolean {
  return prefs.enabled && prefs[kind];
}

/** Which switch governs a push for a chat message (mentions win over plain chats). */
export function messageNotifyKind(mentionsMe: boolean): 'chats' | 'mentions' {
  return mentionsMe ? 'mentions' : 'chats';
}

/** Short status shown under "Meldingen" in Instellingen. */
export function notifySummary(prefs: NotifyPrefs): string {
  if (!prefs.enabled) return 'Uit';
  const kinds = NOTIFY_KEYS.filter(k => k !== 'sound');
  const on = kinds.filter(k => prefs[k]).length;
  if (on === kinds.length) return 'Alle meldingen aan';
  if (on === 0) return 'Alle soorten uit';
  return `${on} van ${kinds.length} soorten aan`;
}
