/** Real provider: Supabase Storage. Buckets/policies: migration 20261013190100_media_buckets.sql (not applied). */
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { BUCKETS, contentType, mediaPath, validateUpload, type MediaStorage } from './storage';

export const supabaseStorage: MediaStorage = {
  name: 'supabase',
  async upload(u) {
    const err = validateUpload(u); if (err) throw new Error(err);
    const bucket = BUCKETS[u.kind], path = mediaPath(u, u.id ?? Crypto.randomUUID());
    const { error } = await supabase.storage.from(bucket).upload(path, u.bytes, { contentType: contentType(u.type), upsert: false });
    if (error) throw error;
    return { bucket, path, size: u.bytes.byteLength, contentType: contentType(u.type) };
  },
  async signedUrl({ bucket, path }, ttlS = 300) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlS);
    if (error) throw error;
    return data.signedUrl;
  },
  async remove(list) {
    let n = 0;
    for (const b of new Set(list.map(s => s.bucket))) {
      const { data, error } = await supabase.storage.from(b).remove(list.filter(s => s.bucket === b).map(s => s.path));
      if (error) throw error; n += data?.length ?? 0;
    }
    return n;
  },
};
