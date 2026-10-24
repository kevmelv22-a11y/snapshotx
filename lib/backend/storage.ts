/** Step 9: media storage abstraction. Pure part + in-memory mock; Supabase provider in storageSupabase.ts. */
export type MediaKind = 'snap' | 'story' | 'memory' | 'chat';
export type MediaType = 'photo' | 'video' | 'voice';
export type Upload = { kind: MediaKind; type: MediaType; ownerId: string; bytes: ArrayBuffer | Uint8Array; id?: string };
export type Stored = { bucket: string; path: string; size: number; contentType: string };

export interface MediaStorage {
  readonly name: 'mock' | 'supabase';
  upload(u: Upload): Promise<Stored>;
  signedUrl(s: Pick<Stored, 'bucket' | 'path'>, ttlS?: number): Promise<string>;
  remove(s: Pick<Stored, 'bucket' | 'path'>[]): Promise<number>;
}

/** Ephemeral snaps/chat media share snapshotx-media (existing); stories + memories get their own buckets. */
export const BUCKETS: Record<MediaKind, string> = { snap: 'snapshotx-media', chat: 'snapshotx-media', story: 'sx-stories', memory: 'sx-memories' };
export const MAX_BYTES: Record<MediaType, number> = { photo: 10 << 20, video: 60 << 20, voice: 5 << 20 };
const EXT: Record<MediaType, [string, string]> = { photo: ['jpg', 'image/jpeg'], video: ['mp4', 'video/mp4'], voice: ['m4a', 'audio/m4a'] };

export function contentType(t: MediaType) { return EXT[t][1]; }
/** `<ownerId>/<kind>/<id>.<ext>` — first segment must equal auth.uid() (bucket policies rely on it). */
export function mediaPath(u: Pick<Upload, 'kind' | 'type' | 'ownerId'>, id: string): string {
  if (!/^[0-9a-z-]{6,}$/i.test(u.ownerId) || !/^[0-9a-z-]+$/i.test(id)) throw new Error('ongeldig pad');
  return `${u.ownerId}/${u.kind}/${id}.${EXT[u.type][0]}`;
}
export function validateUpload(u: Upload): string | null {
  const n = u.bytes.byteLength;
  if (n === 0) return 'Leeg bestand';
  if (n > MAX_BYTES[u.type]) return 'Bestand is te groot';
  if (u.kind === 'story' && u.type === 'voice') return 'Stories ondersteunen geen spraak';
  return null;
}

let seq = 0;
export class MockStorage implements MediaStorage {
  readonly name = 'mock' as const;
  objects = new Map<string, Stored & { bytes: Uint8Array }>();
  async upload(u: Upload): Promise<Stored> {
    const err = validateUpload(u); if (err) throw new Error(err);
    const bucket = BUCKETS[u.kind], path = mediaPath(u, u.id ?? `mock-${++seq}`);
    const bytes = u.bytes instanceof Uint8Array ? u.bytes : new Uint8Array(u.bytes);
    const s = { bucket, path, size: bytes.byteLength, contentType: contentType(u.type) };
    this.objects.set(`${bucket}/${path}`, { ...s, bytes });
    return s;
  }
  async signedUrl(s: Pick<Stored, 'bucket' | 'path'>, ttlS = 300) {
    if (!this.objects.has(`${s.bucket}/${s.path}`)) throw new Error('Object not found');
    return `mock://${s.bucket}/${s.path}?ttl=${ttlS}`;
  }
  async remove(list: Pick<Stored, 'bucket' | 'path'>[]) { let n = 0; for (const s of list) if (this.objects.delete(`${s.bucket}/${s.path}`)) n++; return n; }
}
