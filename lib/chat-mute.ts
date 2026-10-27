/** Snapchat "Berichtmeldingen" per chat (Chatinstellingen → Berichtmeldingen: Alle / Stil).
 *  A silent chat stays in the feed and still gets new messages, but no push banners/sounds.
 *  Pure helpers; per-account state lives in stores/chatFeed.ts (device-local) and is mirrored
 *  best-effort to public.sx_thread_mutes so the push-message edge function can skip it
 *  (migration 20261027120000_chat_mutes.sql — NOT applied). */

export const MUTE_ALWAYS = 'always' as const;
/** threadId -> ISO end time, or 'always'. */
export type MuteMap = Record<string, string>;

export type MuteOption = 'off' | '1h' | '8h' | '1w' | 'always';
export const MUTE_OPTIONS: { id: MuteOption; label: string }[] = [
  { id: 'off', label: 'Alle meldingen' },
  { id: '1h', label: 'Stil voor 1 uur' },
  { id: '8h', label: 'Stil voor 8 uur' },
  { id: '1w', label: 'Stil voor 1 week' },
  { id: 'always', label: 'Stil tot ik het weer aanzet' },
];
const HOUR = 3600000;
const DURATION: Record<Exclude<MuteOption, 'off' | 'always'>, number> = { '1h': HOUR, '8h': 8 * HOUR, '1w': 7 * 24 * HOUR };

const ms = (now: Date | number) => (typeof now === 'number' ? now : now.getTime());

/** The stored value for an option, or null for "Alle meldingen" (unmute). */
export function muteUntil(option: MuteOption, now: Date | number = Date.now()): string | null {
  if (option === 'off') return null;
  if (option === 'always') return MUTE_ALWAYS;
  return new Date(ms(now) + DURATION[option]).toISOString();
}

/** Applies an option to a map (no mutation). Unknown/past values are never written. */
export function setMute(map: MuteMap | undefined, threadId: string, option: MuteOption, now: Date | number = Date.now()): MuteMap {
  const next: MuteMap = { ...(map ?? {}) };
  const until = muteUntil(option, now);
  if (until) next[threadId] = until; else delete next[threadId];
  return next;
}

export function isMuted(map: MuteMap | undefined, threadId: string, now: Date | number = Date.now()): boolean {
  const v = map?.[threadId];
  if (!v) return false;
  if (v === MUTE_ALWAYS) return true;
  const t = Date.parse(v);
  return Number.isFinite(t) && t > ms(now);
}

/** Drops expired timed mutes (keeps storage small). Returns the same object when nothing changed. */
export function pruneMutes(map: MuteMap | undefined, now: Date | number = Date.now()): MuteMap {
  if (!map) return {};
  let changed = false;
  const next: MuteMap = {};
  for (const [id, v] of Object.entries(map)) {
    if (isMuted(map, id, now)) next[id] = v; else changed = true;
  }
  return changed ? next : map;
}

const TIME = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);

/** Short status for the settings sheet: "Alle meldingen", "Stil", "Stil tot 14:30", "Stil tot di 3 nov.". */
export function muteStatus(map: MuteMap | undefined, threadId: string, now: Date | number = Date.now()): string {
  if (!isMuted(map, threadId, now)) return 'Alle meldingen';
  const v = map![threadId];
  if (v === MUTE_ALWAYS) return 'Stil';
  const end = new Date(v);
  return dayKey(end) === dayKey(new Date(ms(now))) ? `Stil tot ${TIME.format(end)}` : `Stil tot ${DAY.format(end)}`;
}

/** Which option to highlight in the picker (timed mutes show their remaining time via muteStatus). */
export function currentOption(map: MuteMap | undefined, threadId: string, now: Date | number = Date.now()): MuteOption | 'timed' {
  if (!isMuted(map, threadId, now)) return 'off';
  return map![threadId] === MUTE_ALWAYS ? 'always' : 'timed';
}

/** Row for public.sx_thread_mutes (muted_until null = always); null means "delete the row". */
export function muteRow(userId: string, threadId: string, until: string | null): { user_id: string; thread_id: string; muted_until: string | null } | null {
  if (!until) return null;
  return { user_id: userId, thread_id: threadId, muted_until: until === MUTE_ALWAYS ? null : until };
}

/** Push filter used by the edge function and native foreground handler: deep-link data → silence? */
export function shouldSilencePush(data: { thread_id?: string; route?: string } | null | undefined, map: MuteMap | undefined, now: Date | number = Date.now()): boolean {
  if (!data) return false;
  const id = data.thread_id ?? (typeof data.route === 'string' ? /^\/chat\/([^/?#]+)/.exec(data.route)?.[1] : undefined);
  return !!id && isMuted(map, id, now);
}
