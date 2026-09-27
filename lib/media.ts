import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
const BUCKET = 'snapshotx-media';
export async function uploadMedia(uri:string, type:'photo'|'video'|'voice') {
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) throw new Error('Log opnieuw in.');
  const ext = type==='photo'?'jpg':type==='video'?'mp4':'m4a';
  const mime = type==='photo'?'image/jpeg':type==='video'?'video/mp4':'audio/m4a';
  const path = `${user.id}/${Crypto.randomUUID()}.${ext}`;
  const bytes = await new File(uri).arrayBuffer();
  const {error} = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType:mime, upsert:false });
  if (error) throw error;
  return path;
}
export async function mediaUrl(path:string, ttl=300) {
  const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  if(error) throw error;
  return data.signedUrl;
}
