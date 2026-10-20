import * as Crypto from 'expo-crypto';
import {supabase} from './supabase';
import {hashPin, memoryInsert, resendMessages, type Memory} from './memories';
// Supabase I/O for Herinneringen (tables from migration 20261013171000_memories.sql).
const digest = (s: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);

export async function loadMemories(uid: string): Promise<Memory[]> {
  const {data, error} = await supabase.from('memories').select('id,storage_path,media_type,created_at,private,caption').eq('owner_id', uid).is('deleted_at', null).order('created_at', {ascending: false}).limit(500);
  if (error) throw error;
  return (data || []) as Memory[];
}
export async function saveToMemories(uid: string, storagePath: string, mediaType: 'photo' | 'video', caption: string | null, source: 'snap' | 'story' = 'snap') {
  const {error} = await supabase.from('memories').insert(memoryInsert(uid, storagePath, mediaType, caption, source));
  if (error) throw error;
}
export async function setMemoryPrivate(id: string, value: boolean) {
  const {error} = await supabase.from('memories').update({private: value}).eq('id', id);
  if (error) throw error;
}
export async function resendMemory(m: Memory, uid: string, friendIds: string[]) {
  const threads: string[] = [];
  for (const id of friendIds) {
    const {data, error} = await supabase.rpc('sx_open_thread', {participants: [id], group_title: null});
    if (error) throw error;
    threads.push(data as string);
  }
  const {error} = await supabase.from('sx_messages').insert(resendMessages(m, uid, threads, Date.now()));
  if (error) throw error;
}
export async function vaultHasPin(uid: string): Promise<boolean> {
  const {data, error} = await supabase.from('sx_memory_vault').select('user_id').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return !!data;
}
export async function setVaultPin(uid: string, pin: string) {
  const salt = Crypto.randomUUID();
  const {error} = await supabase.from('sx_memory_vault').upsert({user_id: uid, pin_salt: salt, pin_hash: await hashPin(pin, salt, digest), updated_at: new Date().toISOString()});
  if (error) throw error;
}
export async function checkVaultPin(uid: string, pin: string): Promise<boolean> {
  const {data, error} = await supabase.from('sx_memory_vault').select('pin_hash,pin_salt').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  if (!data) return false; // no PIN set (yet): nothing can match
  return (await hashPin(pin, data.pin_salt, digest)) === data.pin_hash;
}
