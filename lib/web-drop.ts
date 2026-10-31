/**
 * Snapchat Web: drop a photo/video on the open chat or paste one (Ctrl/⌘+V) to send it.
 * Pure checks so node tests can load them; the DOM wiring lives in hooks/useWebMediaDrop.ts (web only).
 */
export const DROP_MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const DROP_MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const DROP_TEXT = {
  overlay: 'Laat los om te versturen',
  overlaySub: 'Foto of video naar dit gesprek',
  many: 'Eén foto of video tegelijk.',
  type: 'Alleen foto’s en video’s kun je hier neerzetten.',
  photoBig: 'Deze foto is te groot (max. 15 MB).',
  videoBig: 'Deze video is te groot (max. 50 MB).',
  empty: 'Dit bestand is leeg.',
} as const;

export type DropFileLike = { type?: string | null; size?: number | null; name?: string | null };
export type DropPick = { ok: true; index: number; kind: 'photo' | 'video' } | { ok: false; error: string };

const PHOTO_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i, VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

/** Kind of a single file from its MIME type (or extension when the browser gives none); null = not media. */
export function mediaKindOf(f: DropFileLike): 'photo' | 'video' | null {
  const t = String(f.type ?? '').toLowerCase(), n = String(f.name ?? '');
  if (t.startsWith('image/')) return t === 'image/svg+xml' ? null : 'photo';
  if (t.startsWith('video/')) return 'video';
  if (!t && PHOTO_EXT.test(n)) return 'photo';
  if (!t && VIDEO_EXT.test(n)) return 'video';
  return null;
}

/**
 * Which dropped/pasted file to send. Only media files count (a paste with text + an image picks the image);
 * more than one media file is refused rather than silently sending just the first.
 */
export function pickDroppedMedia(files: readonly DropFileLike[]): DropPick | null {
  const media = files.map((f, i) => ({ f, i, kind: mediaKindOf(f) })).filter(x => x.kind);
  if (!files.length) return null;
  if (!media.length) return { ok: false, error: DROP_TEXT.type };
  if (media.length > 1) return { ok: false, error: DROP_TEXT.many };
  const { f, i, kind } = media[0];
  const size = Number(f.size ?? 0);
  if (!(size > 0)) return { ok: false, error: DROP_TEXT.empty };
  if (kind === 'photo' && size > DROP_MAX_PHOTO_BYTES) return { ok: false, error: DROP_TEXT.photoBig };
  if (kind === 'video' && size > DROP_MAX_VIDEO_BYTES) return { ok: false, error: DROP_TEXT.videoBig };
  return { ok: true, index: i, kind: kind! };
}

/** True when a drag carries files (not a text selection / link being dragged). */
export function dragHasFiles(types: readonly string[] | null | undefined): boolean {
  return !!types && Array.from(types).includes('Files');
}

/** Confirm text before sending ("Foto versturen naar Noor?"). */
export function dropConfirm(kind: 'photo' | 'video', to: string): { title: string; message: string; confirmLabel: string } {
  const what = kind === 'photo' ? 'Foto' : 'Video';
  return { title: `${what} versturen naar ${to || 'dit gesprek'}?`, message: 'Blijft zichtbaar in dit gesprek, net als een foto uit je galerij.', confirmLabel: 'Versturen' };
}
