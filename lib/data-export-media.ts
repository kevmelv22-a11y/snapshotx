/**
 * "Mijn gegevens" with photos and videos (Snapchat: "Include your Memories and other media"). The export lists media as
 * storage paths; with this option the files themselves are fetched with the user's own session (signed URL → bytes, so the
 * storage policy decides what is readable) and embedded in the export: inline in the HTML page, base64 in the JSON.
 * Privacy: "Alleen voor mij" memories never have a path in the export, and unsaved snaps (view-once) are not fetched.
 * Limits keep the file openable on a phone: max files / bytes per file / total bytes; whatever does not fit stays a path.
 */
type R = Record<string, unknown>;
export type MediaKind = 'image' | 'video' | 'audio';
export type ExportMediaItem = { path: string; mime: string; kind: MediaKind; size: number; base64: string };
export type ExportMediaSkip = { path: string; reason: 'unavailable' | 'too_big' | 'limit' | 'type' };
export type ExportMedia = { files: ExportMediaItem[]; skipped: ExportMediaSkip[]; bytes: number };
export const MEDIA_LIMITS = { maxFiles: 150, maxFileBytes: 15 * 1024 * 1024, maxTotalBytes: 60 * 1024 * 1024 } as const;

/** Only these types are embedded (a data: URI with another type could be something a browser executes). */
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
};
const ALLOWED = new Set(Object.values(MIME));

/** Mime from the server's content-type when it is one we allow, else from the file extension; null = not embeddable. */
export function mediaMime(path: string, contentType?: string | null): string | null {
  const ct = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  if (ct === 'audio/m4a' || ct === 'audio/x-m4a') return 'audio/mp4';
  if (ALLOWED.has(ct)) return ct;
  const ext = path.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? null;
}
export const mediaKind = (mime: string): MediaKind => (mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'image');

const arr = (v: unknown): R[] => (Array.isArray(v) ? (v as R[]) : []);
/** Unique media paths in an export file (buildDataExport().file), in reading order: chats, stories, memories. */
export function exportMediaPaths(file: R): string[] {
  const out: string[] = [], add = (p: unknown) => { if (typeof p === 'string' && p && !out.includes(p)) out.push(p) };
  for (const c of arr(file.chats)) for (const m of arr(c.messages)) if (m.kind !== 'snap' || m.saved) add(m.media);
  for (const s of arr(file.stories)) add(s.media);
  for (const x of arr(file.memories)) if (!x.private) add(x.media);
  return out;
}

export type MediaFetcher = {
  signedUrl(path: string): Promise<string>;
  fetchBytes(url: string): Promise<{ bytes: ArrayBuffer; contentType?: string | null }>;
  encodeBase64(bytes: ArrayBuffer): string;
};

/** Fetches the files one by one (no burst on the storage API), never throws: unreadable files are listed as skipped. */
export async function collectExportMedia(paths: string[], f: MediaFetcher, limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number } = MEDIA_LIMITS, onProgress?: (done: number, total: number) => void): Promise<ExportMedia> {
  const res: ExportMedia = { files: [], skipped: [], bytes: 0 };
  let i = 0;
  for (const path of paths) {
    onProgress?.(i++, paths.length);
    if (res.files.length >= limits.maxFiles) { res.skipped.push({ path, reason: 'limit' }); continue; }
    if (!mediaMime(path)) { res.skipped.push({ path, reason: 'type' }); continue; }
    let got: { bytes: ArrayBuffer; contentType?: string | null };
    try { got = await f.fetchBytes(await f.signedUrl(path)); } catch { res.skipped.push({ path, reason: 'unavailable' }); continue; }
    const size = got.bytes.byteLength, mime = mediaMime(path, got.contentType);
    if (!mime) { res.skipped.push({ path, reason: 'type' }); continue; }
    if (size > limits.maxFileBytes) { res.skipped.push({ path, reason: 'too_big' }); continue; }
    if (res.bytes + size > limits.maxTotalBytes) { res.skipped.push({ path, reason: 'limit' }); continue; }
    res.files.push({ path, mime, kind: mediaKind(mime), size, base64: f.encodeBase64(got.bytes) });
    res.bytes += size;
  }
  onProgress?.(paths.length, paths.length);
  return res;
}

export const SKIP_TEXT: Record<ExportMediaSkip['reason'], string> = {
  unavailable: 'Niet meer beschikbaar', too_big: 'Te groot om mee te sturen', limit: 'Past niet meer in dit bestand', type: 'Bestandstype niet ondersteund',
};

/** The JSON part: same files, as base64 with their storage path, so another app can restore them. */
export function mediaJson(media: ExportMedia) {
  return {
    included: media.files.length, total_bytes: media.bytes,
    files: media.files.map(m => ({ path: m.path, mime: m.mime, size: m.size, data_base64: m.base64 })),
    not_included: media.skipped.map(s => ({ path: s.path, reason: SKIP_TEXT[s.reason] })),
  };
}

/** "3 foto’s/video’s" for the result card; "" when media was not requested. */
export function mediaSummary(media: ExportMedia | null | undefined) {
  if (!media) return '';
  const n = media.files.length, mb = media.bytes / (1024 * 1024);
  return `${n} ${n === 1 ? 'foto/video' : 'foto’s/video’s'}${n ? ` (${mb < 0.1 ? '<0,1' : mb.toFixed(1).replace('.', ',')} MB)` : ''}${media.skipped.length ? ` · ${media.skipped.length} niet meegestuurd` : ''}`;
}

/** Strict base64 check before anything goes into a data: URI. */
export const isBase64 = (s: string) => /^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length % 4 === 0;
