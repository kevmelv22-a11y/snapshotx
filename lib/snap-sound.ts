/** Snap sound (Snapchat "Geluiden" + "Stemfilters"): a bundled music loop under a snap/story and a voice filter for
 *  video snaps. Music: our own synthesized loops (scripts/sounds/gen-tracks.mjs) — no third-party / copyrighted tracks.
 *  Voice filters change pitch at playback (playbackRate without pitch correction), so the uploaded file is untouched.
 *  Stored as one short text column `sound` on sx_messages / sx_stories: "m:<track>", "v:<filter>" or "m:<track>;v:<filter>". */
import { dbErrorKind } from './db-errors';

export type TrackId = 'zomerzon' | 'chill-avond' | 'straatbeat' | 'droomwolk';
export type VoiceFilterId = 'helium' | 'eekhoorn' | 'reus' | 'slowmo';
export type MusicTrack = { id: TrackId; title: string; mood: string; emoji: string };
export type VoiceFilter = { id: VoiceFilterId; label: string; emoji: string; rate: number };
export type SnapSound = { music: TrackId | null; voice: VoiceFilterId | null };

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'zomerzon', title: 'Zomerzon', mood: 'Vrolijk', emoji: '☀️' },
  { id: 'chill-avond', title: 'Chill avond', mood: 'Relaxed', emoji: '🌙' },
  { id: 'straatbeat', title: 'Straatbeat', mood: 'Stoer', emoji: '🔊' },
  { id: 'droomwolk', title: 'Droomwolk', mood: 'Dromerig', emoji: '☁️' },
];
export const VOICE_FILTERS: readonly VoiceFilter[] = [
  { id: 'helium', label: 'Helium', emoji: '🎈', rate: 1.35 },
  { id: 'eekhoorn', label: 'Eekhoorn', emoji: '🐿️', rate: 1.6 },
  { id: 'reus', label: 'Reus', emoji: '🧌', rate: 0.75 },
  { id: 'slowmo', label: 'Slow-mo', emoji: '🐢', rate: 0.6 },
];
const TRACKS = new Map(MUSIC_TRACKS.map(t => [t.id, t]));
const FILTERS = new Map(VOICE_FILTERS.map(f => [f.id, f]));
export const NO_SOUND: SnapSound = { music: null, voice: null };

export const trackById = (id: string | null | undefined) => (id ? TRACKS.get(id as TrackId) ?? null : null);
export const filterById = (id: string | null | undefined) => (id ? FILTERS.get(id as VoiceFilterId) ?? null : null);

/** Column value, or null when there is no sound. Voice filters only apply to video. */
export function encodeSound(s: SnapSound, mediaType: 'photo' | 'video'): string | null {
  const parts: string[] = [];
  if (s.music && TRACKS.has(s.music)) parts.push(`m:${s.music}`);
  if (mediaType === 'video' && s.voice && FILTERS.has(s.voice)) parts.push(`v:${s.voice}`);
  return parts.length ? parts.join(';') : null;
}
/** Tolerant parse: unknown tracks / filters are dropped (older or newer clients). */
export function parseSound(v: string | null | undefined): SnapSound {
  const out: SnapSound = { music: null, voice: null };
  if (typeof v !== 'string' || v.length > 60) return out;
  for (const part of v.split(';')) {
    const [k, id] = part.split(':');
    if (k === 'm' && TRACKS.has(id as TrackId)) out.music = id as TrackId;
    if (k === 'v' && FILTERS.has(id as VoiceFilterId)) out.voice = id as VoiceFilterId;
  }
  return out;
}
/** Playback rate for the video (1 = no filter); pitch correction must be off for the filter to be audible. */
export function playbackRateFor(s: SnapSound): number { return filterById(s.voice)?.rate ?? 1; }
/** Short Dutch label under the snap ("♪ Zomerzon · 🎈 Helium"), '' when nothing is set. */
export function soundLabel(s: SnapSound): string {
  const t = trackById(s.music), f = filterById(s.voice);
  return [t ? `♪ ${t.title}` : '', f ? `${f.emoji} ${f.label}` : ''].filter(Boolean).join(' · ');
}
/** Server without the `sound` column yet (migration not applied): send again without it so the snap still goes out. */
export function isMissingSound(error: unknown): boolean {
  const msg = String((error as { message?: unknown } | null)?.message ?? '');
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  return (code === '42703' || code === 'PGRST204' || dbErrorKind(error) === 'missing_column') && /\bsound\b/i.test(msg);
}
type Row = Record<string, unknown>;
export async function insertWithSound(insert: (row: Row) => PromiseLike<{ error: unknown }>, row: Row): Promise<{ error: unknown }> {
  const first = await insert(row);
  if (!first.error || !('sound' in row) || !isMissingSound(first.error)) return { error: first.error ?? null };
  const rest = { ...row }; delete rest.sound;
  const second = await insert(rest);
  return { error: second.error ?? null };
}
